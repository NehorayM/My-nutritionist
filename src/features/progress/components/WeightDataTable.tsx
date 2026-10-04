import { Fragment, type ReactNode } from 'react'
import { cn } from '@/components/ui'
import type { WeightChartGranularity, WeightRange } from '@/domain/weight'
import { formatNumber } from '@/lib/format'
import type { WeightUnit } from '@/types'
import { pointDateLabel, RANGE_LABELS, type ChartDatum } from '../lib/chartModel'

interface WeightDataTableProps {
  id: string
  data: readonly ChartDatum[]
  range: WeightRange
  granularity: WeightChartGranularity
  unit: WeightUnit
  showTarget: boolean
  today: string
}

/**
 * Numeric column header: the label (wrapping only between words, never at "Weigh-in"'s hyphen), then
 * the unit on its own line so narrow columns stay readable.
 */
function ValueHeader({ label, unit }: { label: string; unit: WeightUnit }) {
  return (
    <th scope="col" className="px-2.5 py-2 text-right align-bottom">
      {label.split(' ').map((word, index) => (
        <Fragment key={word}>
          {index > 0 ? ' ' : null}
          <span className="whitespace-nowrap">{word}</span>
        </Fragment>
      ))}{' '}
      <span className="block font-medium">({unit})</span>
    </th>
  )
}

function ValueCell({ value, muted = false }: { value: number | null; muted?: boolean }) {
  let content: ReactNode = formatNumber(value, 1)
  if (value === null) {
    content = (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">none</span>
      </>
    )
  }
  return <td className={cn('whitespace-nowrap px-2.5 py-2 text-right', muted ? 'text-text-muted' : 'text-text')}>{content}</td>
}

/** Accessible alternative to the chart: one row per plotted point, values in the user's unit. */
export function WeightDataTable({ id, data, range, granularity, unit, showTarget, today }: WeightDataTableProps) {
  return (
    <div id={id} className="max-h-80 overflow-auto rounded-field ring-1 ring-border/70">
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">{`Plotted weights, ${RANGE_LABELS[range].toLowerCase()}, in ${unit}`}</caption>
        <thead className="sticky top-0 bg-surface-2 text-xs font-semibold text-text-muted">
          <tr>
            <th scope="col" className="py-2 pl-3 pr-2 align-bottom">
              Date
            </th>
            <ValueHeader label={granularity === 'week' ? 'Weekly average' : 'Weigh-in'} unit={unit} />
            <ValueHeader label="7-day trend" unit={unit} />
            {showTarget ? <ValueHeader label="Target pace" unit={unit} /> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date} className="border-t border-border/60">
              <th
                scope="row"
                className={cn('py-2 pl-3 pr-2 font-semibold text-text', granularity === 'day' && 'whitespace-nowrap')}
              >
                {pointDateLabel(row.date, granularity, today)}
              </th>
              <ValueCell value={row.weight} />
              <ValueCell value={row.trend} muted />
              {showTarget ? <ValueCell value={row.target} muted /> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
