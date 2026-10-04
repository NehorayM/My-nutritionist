import { ChevronDown, X } from 'lucide-react'
import { IconButton } from '@/components/ui'
import type { CatchUpSuggestion } from '@/domain/activity'
import { formatDateLabel, formatDuration } from '@/lib/format'
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '../model/labels'
import { WorkoutTypeBadge } from './WorkoutTypeIcon'

interface SuggestionRowProps {
  suggestion: CatchUpSuggestion
  today: string
  onDismiss: (suggestion: CatchUpSuggestion) => void
}

/** One suggested session: day, type, length, intensity, and the reasoning behind the day (on demand). */
export function SuggestionRow({ suggestion, today, onDismiss }: SuggestionRowProps) {
  const day = formatDateLabel(suggestion.date, today)
  const type = WORKOUT_TYPE_LABELS[suggestion.type]
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <WorkoutTypeBadge type={suggestion.type} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-accent-ink">{day}</p>
        <p className="font-semibold text-text">
          {type} · {formatDuration(suggestion.durationMin)}
        </p>
        <p className="text-sm text-text-muted">{INTENSITY_LABELS[suggestion.intensity]} intensity</p>
        <details className="group mt-1">
          <summary className="hit-area inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
            Why this day
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <p className="mt-1.5 text-sm text-text-muted">{suggestion.rationale}</p>
        </details>
      </div>
      <IconButton
        label={`Dismiss ${type.toLowerCase()} suggestion for ${day}`}
        icon={<X />}
        size="sm"
        className="-mr-2 -mt-1.5 shrink-0 text-text-muted"
        onClick={() => onDismiss(suggestion)}
      />
    </li>
  )
}
