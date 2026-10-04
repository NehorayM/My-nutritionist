import type { FilterQuery, QueryResult, ReturningQuery, SupabaseDataClient, TableQuery } from '../client'

/**
 * Small in-memory stand-in for the supabase-js query builder (tests only).
 * Supports exactly what the repositories use: select / upsert(onConflict) + select / delete, eq / gte / lte
 * filters, order, range, limit, abortSignal. Upserts apply the same stale-write rule as the database
 * trigger (an update older than the stored row is skipped and returns no row) and keep `created_at`.
 * Every executed request is recorded in `calls`.
 */
export type Row = Record<string, unknown>
type Filter = { op: 'eq' | 'gte' | 'lte'; column: string; value: string }

export interface RecordedCall {
  table: string
  method: 'select' | 'upsert' | 'delete'
  columns: string | null
  filters: Filter[]
  order: { column: string; ascending: boolean }[]
  range: [number, number] | null
  limit: number | null
  onConflict: string | null
  values: Row | null
  signal: AbortSignal | null
}

type Failure = { table?: string; method?: RecordedCall['method']; result?: Omit<QueryResult, 'data'>; throws?: unknown }

function compare(a: unknown, b: unknown): number {
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

function matches(row: Row, filters: readonly Filter[]): boolean {
  return filters.every(({ op, column, value }) => {
    const cell = String(row[column])
    if (op === 'eq') return cell === value
    return op === 'gte' ? cell >= value : cell <= value
  })
}

class FakeQuery implements FilterQuery {
  readonly #db: FakeSupabase
  readonly #call: RecordedCall

  constructor(db: FakeSupabase, call: RecordedCall) {
    this.#db = db
    this.#call = call
  }

  eq(column: string, value: string): this {
    this.#call.filters.push({ op: 'eq', column, value })
    return this
  }

  gte(column: string, value: string): this {
    this.#call.filters.push({ op: 'gte', column, value })
    return this
  }

  lte(column: string, value: string): this {
    this.#call.filters.push({ op: 'lte', column, value })
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.#call.order.push({ column, ascending: options.ascending })
    return this
  }

  range(from: number, to: number): this {
    this.#call.range = [from, to]
    return this
  }

  limit(count: number): this {
    this.#call.limit = count
    return this
  }

  abortSignal(signal: AbortSignal): this {
    this.#call.signal = signal
    return this
  }

  then<A = QueryResult, B = never>(
    onfulfilled?: ((value: QueryResult) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.#db.execute(this.#call))
      .then(onfulfilled, onrejected)
  }
}

export class FakeSupabase implements SupabaseDataClient {
  readonly tables = new Map<string, Row[]>()
  readonly calls: RecordedCall[] = []
  /** When true, filters are ignored (simulates a server that returns too much) — tests defense in depth. */
  ignoreFilters = false
  #failures: Failure[] = []

  rows(table: string): Row[] {
    let rows = this.tables.get(table)
    if (!rows) {
      rows = []
      this.tables.set(table, rows)
    }
    return rows
  }

  /** Stores rows exactly as given (e.g. mapper output, or raw values such as numeric strings). */
  seed(table: string, ...rows: object[]): void {
    this.rows(table).push(...rows.map((row) => structuredClone(row) as Row))
  }

  /** The next matching request fails with `result` (returned) or `throws` (rejected). */
  failNext(failure: Failure): void {
    this.#failures.push(failure)
  }

  from(table: string): TableQuery {
    const call = (method: RecordedCall['method'], extra: Partial<RecordedCall> = {}): RecordedCall => ({
      table,
      method,
      columns: null,
      filters: [],
      order: [],
      range: null,
      limit: null,
      onConflict: null,
      values: null,
      signal: null,
      ...extra,
    })
    return {
      select: (columns) => new FakeQuery(this, call('select', { columns })),
      upsert: (values, options): ReturningQuery => ({
        select: (columns) =>
          new FakeQuery(this, call('upsert', { columns, values: structuredClone(values) as Row, onConflict: options.onConflict })),
      }),
      delete: () => new FakeQuery(this, call('delete')),
    }
  }

  execute(call: RecordedCall): QueryResult {
    this.calls.push(call)
    const index = this.#failures.findIndex((f) => (f.table ?? call.table) === call.table && (f.method ?? call.method) === call.method)
    if (index >= 0) {
      const [failure] = this.#failures.splice(index, 1)
      if (failure?.throws !== undefined) throw failure.throws
      return { data: null, error: failure?.result?.error ?? null, status: failure?.result?.status ?? 500 }
    }
    const rows = this.rows(call.table)
    const filters = this.ignoreFilters ? [] : call.filters
    if (call.method === 'delete') {
      this.tables.set(call.table, rows.filter((row) => !matches(row, filters)))
      return { data: null, error: null, status: 204 }
    }
    if (call.method === 'upsert') return this.#upsert(rows, call.values ?? {})
    let result = rows.filter((row) => matches(row, filters))
    result.sort((a, b) => {
      for (const { column, ascending } of call.order) {
        const order = compare(a[column], b[column])
        if (order !== 0) return ascending ? order : -order
      }
      return 0
    })
    if (call.range) result = result.slice(call.range[0], call.range[1] + 1)
    if (call.limit !== null) result = result.slice(0, call.limit)
    return { data: structuredClone(result), error: null, status: 200 }
  }

  #upsert(rows: Row[], values: Row): QueryResult {
    const index = rows.findIndex((row) => row.id === values.id)
    const existing = rows[index]
    if (existing) {
      if (compare(values.updated_at, existing.updated_at) < 0) return { data: [], error: null, status: 201 }
      rows[index] = { ...values, created_at: existing.created_at }
    } else {
      rows.push(values)
    }
    return { data: [structuredClone(rows[index] ?? values)], error: null, status: 201 }
  }
}
