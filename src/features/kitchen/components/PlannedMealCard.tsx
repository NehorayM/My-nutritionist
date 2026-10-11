import { Clock, Flame, Shuffle, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Switch } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import type { MealPlan, MealOption } from '@/domain/planner'
import { formatNumber } from '@/lib/format'
import { EQUIPMENT_LABELS, gapText } from '../model/labels'
import { logPlannedMeal } from '../services/kitchenActions'

interface PlannedMealCardProps {
  plan: MealPlan
  /** The option the day plan picked (falls back to the meal's best option). */
  chosen: MealOption | null
  today: string
}

function amount(item: MealOption['items'][number]): string {
  return item.servingLabel ? `${formatNumber(item.quantity, Number.isInteger(item.quantity) ? 0 : 1)} × ${item.servingLabel}` : `${formatNumber(item.grams)} g`
}

/** One planned meal: its items with amounts and preparation, totals, other options, and logging it. */
export function PlannedMealCard({ plan, chosen, today }: PlannedMealCardProps) {
  const options = chosen ? [chosen, ...plan.options.filter((option) => option.id !== chosen.id)] : plan.options
  const [index, setIndex] = useState(0)
  const [updateKitchen, setUpdateKitchen] = useState(true)
  const [logging, setLogging] = useState(false)
  const option = options[index % Math.max(1, options.length)] ?? null
  const label = mealLabel(plan.mealType)

  return (
    <Card as="article" aria-label={`${label} plan`}>
      <CardHeader action={option ? <Badge tone="primary">{formatNumber(option.totals.kcal)} kcal</Badge> : null}>
        <CardTitle>{label}</CardTitle>
        <p className="text-sm text-text-muted">
          {formatNumber(plan.range.min)}–{formatNumber(plan.range.max)} kcal
        </p>
      </CardHeader>
      {option ? (
        <>
          <CardContent className="space-y-3 pt-3">
            <ul className="space-y-2" aria-label={`${label} items`}>
              {option.items.map((item) => (
                <li key={item.pantryItemId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-text">{item.food.name}</span>
                    <span className="block text-text-muted">
                      {amount(item)}
                      {item.equipment ? ` · ${item.prep === 'reheat' ? 'warm' : 'cook'} in ${EQUIPMENT_LABELS[item.equipment].toLowerCase()}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-text-muted">{formatNumber(item.kcal)} kcal</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Badge icon={<Clock />}>{option.prepMinutes === 0 ? 'No prep' : `${option.prepMinutes} min`}</Badge>
              <Badge tone="protein" icon={<Utensils />}>{formatNumber(option.totals.protein)} g protein</Badge>
              {option.usesSoon ? <Badge tone="warning" icon={<Flame />}>Uses food to finish soon</Badge> : null}
            </div>
            <Switch checked={updateKitchen} onCheckedChange={setUpdateKitchen} label="Take it out of my kitchen when logged" />
          </CardContent>
          <CardFooter>
            <Button
              loading={logging}
              onClick={async () => {
                setLogging(true)
                await logPlannedMeal(option, today, updateKitchen)
                setLogging(false)
              }}
            >
              Log to {label.toLowerCase()}
            </Button>
            {options.length > 1 ? (
              <Button variant="ghost" leadingIcon={<Shuffle />} onClick={() => setIndex((i) => i + 1)}>
                Other option
              </Button>
            ) : null}
          </CardFooter>
        </>
      ) : (
        <CardContent className="pt-3">
          <p className="rounded-field bg-surface-2 px-3 py-2.5 text-sm text-text">{gapText(plan.gap ?? 'nothing_available', plan.range)}</p>
        </CardContent>
      )}
    </Card>
  )
}
