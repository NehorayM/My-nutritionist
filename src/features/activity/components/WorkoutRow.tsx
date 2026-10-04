import { Pencil, Trash2 } from 'lucide-react'
import { Fragment } from 'react'
import { Badge, IconButton } from '@/components/ui'
import { formatDateLabel, formatDuration } from '@/lib/format'
import type { WorkoutEntry } from '@/types'
import { CATEGORY_LABELS, CATEGORY_TONES, INTENSITY_LABELS, WORKOUT_TYPE_LABELS, workoutCategory, workoutKcalText } from '../model/labels'
import { WorkoutTypeBadge } from './WorkoutTypeIcon'

interface WorkoutRowProps {
  workout: WorkoutEntry
  today: string
  onEdit: (workout: WorkoutEntry) => void
  onDelete: (workout: WorkoutEntry) => void
}

/** One logged workout with its informational energy estimate and edit/delete actions. */
export function WorkoutRow({ workout, today, onEdit, onDelete }: WorkoutRowProps) {
  const type = WORKOUT_TYPE_LABELS[workout.type]
  const day = formatDateLabel(workout.date, today)
  const category = workoutCategory(workout)
  const kcal = workoutKcalText(workout)
  const details = [day, workout.intensity ? INTENSITY_LABELS[workout.intensity] : null, kcal].filter((detail) => detail !== null)
  return (
    <li className="flex gap-3 px-4 py-3">
      <WorkoutTypeBadge type={workout.type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold text-text">
            {type} · {formatDuration(workout.durationMin)}
          </p>
          {category && CATEGORY_LABELS[category] !== type ? <Badge tone={CATEGORY_TONES[category]}>{CATEGORY_LABELS[category]}</Badge> : null}
        </div>
        <p className="text-sm text-text-muted">
          {details.map((detail, index) => (
            <Fragment key={detail}>
              {index > 0 ? ' · ' : null}
              <span className="whitespace-nowrap">{detail}</span>
            </Fragment>
          ))}
        </p>
        {workout.notes ? <p className="mt-1 line-clamp-2 break-words text-sm text-text">{workout.notes}</p> : null}
      </div>
      <div className="-mr-2 flex shrink-0 items-start">
        <IconButton label={`Edit ${type.toLowerCase()} workout, ${day}`} icon={<Pencil />} size="sm" onClick={() => onEdit(workout)} />
        <IconButton label={`Delete ${type.toLowerCase()} workout, ${day}`} icon={<Trash2 />} size="sm" onClick={() => onDelete(workout)} />
      </div>
    </li>
  )
}
