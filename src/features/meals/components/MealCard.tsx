import { BookmarkPlus, ChevronDown, Plus, Repeat2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, Card, CardDescription, CardHeader, CardTitle, cn, IconButton } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { formatKcal } from '@/lib/format'
import type { MealEntry, MealType, NutrientTotals } from '@/types'
import { knownValue } from '../model/summary'
import { EntryRow } from './EntryRow'
import { MacroLine } from './MacroLine'
import { MealDetails } from './MealDetails'

interface MealCardProps {
  mealType: MealType
  entries: readonly MealEntry[]
  totals: NutrientTotals
  /** Label of "Repeat …" when the previous day had this meal (e.g. "Repeat yesterday's lunch"), else null. */
  repeatLabel: string | null
  onAdd: (mealType: MealType) => void
  onRepeat: (mealType: MealType) => Promise<void>
  onEdit: (entry: MealEntry) => void
  onDelete: (entry: MealEntry) => void
  onSaveMeal: (mealType: MealType) => void
}

/** One meal of the day: its foods with totals and details, or an empty state with quick actions. */
export function MealCard({ mealType, entries, totals, repeatLabel, onAdd, onRepeat, onEdit, onDelete, onSaveMeal }: MealCardProps) {
  const titleId = useId()
  const detailsId = useId()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const label = mealLabel(mealType)
  const count = entries.length
  const kcal = formatKcal(knownValue(totals.calories))

  async function repeat() {
    setRepeating(true)
    await onRepeat(mealType)
    setRepeating(false)
  }

  return (
    <Card as="section" aria-labelledby={titleId}>
      <CardHeader
        className="pb-1"
        action={
          // An empty meal offers "Add food" in its body instead.
          count === 0 ? undefined : (
            <IconButton label={`Add food to ${label}`} icon={<Plus />} variant="subtle" onClick={() => onAdd(mealType)} />
          )
        }
      >
        <CardTitle id={titleId}>{label}</CardTitle>
        <CardDescription>{count === 0 ? 'Nothing logged yet' : `${kcal} · ${count} ${count === 1 ? 'item' : 'items'}`}</CardDescription>
      </CardHeader>
      {count === 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-5 pt-3">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus />}
            aria-label={`Add food to ${label}`}
            onClick={() => onAdd(mealType)}
          >
            Add food
          </Button>
          {repeatLabel ? (
            <Button variant="subtle" size="sm" leadingIcon={<Repeat2 />} loading={repeating} onClick={() => void repeat()}>
              {repeatLabel}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul aria-label={`${label} foods`} className="divide-y divide-border/60 px-5 pt-1">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
          <div className="mx-5 space-y-0.5 border-t border-border/60 pb-1 pt-3">
            <p className="flex items-baseline justify-between gap-3 text-sm font-semibold text-text">
              <span>{label} total</span>
              <span className="tabular-nums">{kcal}</span>
            </p>
            <MacroLine
              amounts={{
                protein: knownValue(totals.protein),
                carbs: knownValue(totals.carbs),
                fat: knownValue(totals.fat),
                fiber: knownValue(totals.fiber),
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              trailingIcon={<ChevronDown className={cn('transition-transform', detailsOpen && 'rotate-180')} />}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              Details
            </Button>
            <Button variant="ghost" size="sm" leadingIcon={<BookmarkPlus />} onClick={() => onSaveMeal(mealType)}>
              Save as meal
            </Button>
          </div>
          <MealDetails id={detailsId} hidden={!detailsOpen} totals={totals} />
        </>
      )}
    </Card>
  )
}
