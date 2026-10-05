import { execFileSync } from 'node:child_process'

/**
 * Access to the LOCAL Supabase stack for the DB tests. Keys are read at runtime from the CLI
 * (`supabase status -o env`) so no key is ever written to a repository file.
 */
export interface LocalStackEnv {
  apiUrl: string
  publishableKey: string
  /** sb_secret_… (service_role). Test tooling only — never shipped to a browser. */
  secretKey: string
}

const CLI_TIMEOUT_MS = 60_000

function runCli(args: string[]): string {
  return execFileSync('npx', ['supabase', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: CLI_TIMEOUT_MS,
  })
}

/** Parses `KEY="value"` lines printed by `supabase status -o env`. */
export function parseStatusEnv(output: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line.trim())
    if (match?.[1] !== undefined && match[2] !== undefined) values.set(match[1], match[2])
  }
  return values
}

export function readLocalStackEnv(): LocalStackEnv {
  let output: string
  try {
    output = runCli(['status', '-o', 'env'])
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`The local Supabase stack is not reachable (run \`npm run db:start\`): ${reason}`, { cause: error })
  }
  const values = parseStatusEnv(output)
  const apiUrl = values.get('API_URL')
  const publishableKey = values.get('PUBLISHABLE_KEY')
  const secretKey = values.get('SECRET_KEY')
  if (!apiUrl || !publishableKey || !secretKey) {
    throw new Error('`supabase status -o env` did not print API_URL, PUBLISHABLE_KEY and SECRET_KEY')
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl)) {
    throw new Error(`Refusing to run destructive DB tests against a non-local API (${apiUrl})`)
  }
  return { apiUrl, publishableKey, secretKey }
}

/** Runs read-only catalog SQL against the local database and returns the rows. */
export function queryLocalDb<Row>(sql: string): Row[] {
  const output = runCli(['db', 'query', '--local', '-o', 'json', sql])
  const start = output.indexOf('{')
  if (start < 0) throw new Error(`Unexpected \`supabase db query\` output: ${output.slice(0, 200)}`)
  const parsed: unknown = JSON.parse(output.slice(start))
  if (typeof parsed !== 'object' || parsed === null || !('rows' in parsed) || !Array.isArray(parsed.rows)) {
    throw new Error('`supabase db query` returned no rows array')
  }
  return parsed.rows as Row[]
}
