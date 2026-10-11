import { Settings2 } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { mealEquipment, type KcalRange } from '@/domain/planner'
import { formatNumber } from '@/lib/format'
import { MEAL_TYPES, type PlannerSettings } from '@/types'
import { equipmentList } from '../model/labels'

interface ConstraintsSummaryProps {
  settings: PlannerSettings
  day: KcalRange | null
  onEdit: () => void
}

/** The planner's limits at a glance (equipment, cooking, time, calories), with Edit. */
export function ConstraintsSummary({ settings, day, onEdit }: ConstraintsSummaryProps) {
  const planned = MEAL_TYPES.filter((meal) => settings.meals[meal].enabled)
  return (
    <Card>
      <CardHeader
        action={
          <Button size="sm" variant="ghost" leadingIcon={<Settings2 />} onClick={onEdit}>
            Edit
          </Button>
        }
      >
        <CardTitle as="h2">Kitchen & time</CardTitle>
        <CardDescription>
          {day ? `Day: ${formatNumber(day.min)}–${formatNumber(day.max)} kcal` : 'Calories follow your daily target'}
          {settings.equipmentScope === 'day' ? ` · ${settings.dayEquipment.length > 0 ? equipmentList(settings.dayEquipment) : 'no heating'}` : ' · equipment per meal'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="grid gap-2 text-sm sm:grid-cols-2" aria-label="Meal limits">
          {planned.map((meal) => {
            const constraint = settings.meals[meal]
            const tools = mealEquipment(settings, meal)
            return (
              <li key={meal} className="rounded-field bg-surface-2 px-3 py-2">
                <span className="font-semibold text-text">{mealLabel(meal)}</span>
                <span className="block text-text-muted">
                  {constraint.canCook ? 'Cooking ok' : 'No cooking'} · {constraint.maxMinutes} min
                  {tools.length === 0 ? ' · ready-to-eat only' : ` · ${equipmentList(tools)}`}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
