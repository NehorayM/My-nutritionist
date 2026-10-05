import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'
import type { FoodItem } from '@/types'
import { kcalPer100gText } from '../model/foods'
import { SOURCE_TONES, sourceLabel } from '../model/labels'

interface FoodRowProps {
  food: FoodItem
  onSelect: (food: FoodItem) => void
  /** Replaces the "kcal / 100 g" line (e.g. the last logged amount). */
  detail?: ReactNode
  /** Trailing actions next to the row button (IconButtons). */
  actions?: ReactNode
}

/** A food in a list: name (two lines max, full name on hover and in the detail view), brand, energy and source. */
export function FoodRow({ food, onSelect, detail, actions }: FoodRowProps) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(food)}
        title={food.name}
        className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-field px-2 py-2.5 text-left transition-colors hover:bg-text/4"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 break-words font-semibold leading-snug text-text">{food.name}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            {food.brand ? <span className="max-w-full truncate">{food.brand}</span> : null}
            <span className="min-w-0 max-w-full truncate">{detail ?? kcalPer100gText(food)}</span>
            <Badge tone={SOURCE_TONES[food.source]}>{sourceLabel(food)}</Badge>
          </span>
        </span>
        {actions ? null : <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-muted" />}
      </button>
      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </li>
  )
}
