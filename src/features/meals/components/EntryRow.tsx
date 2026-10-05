import { Trash2 } from 'lucide-react'
import { useId } from 'react'
import { IconButton } from '@/components/ui'
import { portionNutrients } from '@/domain/nutrition'
import { formatKcal } from '@/lib/format'
import type { MealEntry } from '@/types'
import { formatPortionAmount } from '../model/portion'
import { MacroLine } from './MacroLine'

interface EntryRowProps {
  entry: MealEntry
  onEdit: (entry: MealEntry) => void
  onDelete: (entry: MealEntry) => void
}

/** One logged food: name (up to two lines, full name on hover and in the edit sheet), amount, kcal and macros. */
export function EntryRow({ entry, onEdit, onDelete }: EntryRowProps) {
  const detailsId = useId()
  const nutrients = portionNutrients(entry)
  const amount = formatPortionAmount(entry)
  const subtitle = [entry.brand, amount].filter(Boolean).join(' · ')

  return (
    <li className="flex items-start gap-1">
      <button
        type="button"
        onClick={() => onEdit(entry)}
        aria-label={`Edit ${entry.foodName}`}
        aria-describedby={detailsId}
        title={entry.foodName}
        className="-ml-2 flex min-w-0 flex-1 flex-col gap-0.5 rounded-field px-2 py-2.5 text-left transition-colors hover:bg-text/4"
      >
        <span id={detailsId} className="flex w-full min-w-0 flex-col gap-0.5">
          <span className="flex w-full items-start gap-3">
            <span className="line-clamp-2 min-w-0 flex-1 break-words font-semibold leading-snug text-text">{entry.foodName}</span>
            <span className="shrink-0 font-semibold tabular-nums text-text">{formatKcal(nutrients.calories)}</span>
          </span>
          <span className="truncate text-sm text-text-muted">{subtitle}</span>
          <MacroLine amounts={nutrients} />
        </span>
      </button>
      <IconButton label={`Remove ${entry.foodName}`} icon={<Trash2 />} size="sm" className="mt-1.5 shrink-0" onClick={() => onDelete(entry)} />
    </li>
  )
}
