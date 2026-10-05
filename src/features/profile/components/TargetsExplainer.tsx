import { Calculator } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { NUTRIENTS } from '@/domain/nutrients'
import { useToday } from '@/hooks/useToday'
import { formatKcal, formatNutrient } from '@/lib/format'
import { useDailyTargets } from '@/stores/derived'
import { NUTRIENT_KEYS } from '@/types'

/** "How targets are calculated": the numbers in use and the assumptions behind them. */
export function TargetsExplainer() {
  const today = useToday()
  const targets = useDailyTargets(today)
  const { estimate } = targets
  const rows = NUTRIENT_KEYS.flatMap((key) => {
    const target = targets.targets[key]
    if (!target || key === 'calories') return []
    const prefix = target.kind === 'limit' ? 'Up to ' : ''
    return [{ key, label: NUTRIENTS[key].label, value: `${prefix}${formatNutrient(key, target.amount, { unit: true })}` }]
  })

  return (
    <Card as="section" aria-labelledby="targets-title">
      <CardHeader>
        <CardTitle as="h2" id="targets-title">
          <Calculator aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          How targets are calculated
        </CardTitle>
        <CardDescription>Estimates for general wellness, not medical advice.</CardDescription>
      </CardHeader>
      <CardContent>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between rounded-field text-sm font-semibold text-primary">
            <span>
              {targets.mode === 'personalized' ? 'Personalized estimate' : 'General estimate'} · {formatKcal(targets.targets.calories?.amount ?? estimate.maintenanceKcal)} a day
            </span>
            <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-3 grid gap-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-text-muted">Resting energy</dt>
              <dd className="text-right tabular-nums">{estimate.bmrKcal === null ? 'Not estimated' : formatKcal(estimate.bmrKcal)}</dd>
              <dt className="text-text-muted">Maintenance</dt>
              <dd className="text-right tabular-nums">{formatKcal(estimate.maintenanceKcal)}</dd>
              <dt className="text-text-muted">Goal adjustment</dt>
              <dd className="text-right tabular-nums">
                {estimate.goalAdjustmentKcal === 0 ? 'None' : `${estimate.goalAdjustmentKcal > 0 ? '+' : '−'}${formatKcal(Math.abs(estimate.goalAdjustmentKcal))}`}
              </dd>
              {rows.map((row) => (
                <div key={row.key} className="contents">
                  <dt className="text-text-muted">{row.label}</dt>
                  <dd className="text-right tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="grid list-disc gap-1.5 pl-5 text-text-muted">
              {targets.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
