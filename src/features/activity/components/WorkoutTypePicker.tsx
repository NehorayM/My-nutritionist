import { ToggleChip } from '@/components/ui'
import { WORKOUT_TYPES, type WorkoutType } from '@/types'
import { WORKOUT_TYPE_LABELS } from '../model/labels'
import { WorkoutTypeIcon } from './WorkoutTypeIcon'

interface WorkoutTypePickerProps {
  value: WorkoutType
  onChange: (type: WorkoutType) => void
  /** Short note under the chips (what this type counts toward). */
  hint: string
}

/** Single-choice workout type as icon chips (pressed = selected). */
export function WorkoutTypePicker({ value, onChange, hint }: WorkoutTypePickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-text">Type</legend>
      <div className="flex flex-wrap gap-2">
        {WORKOUT_TYPES.map((type) => (
          <ToggleChip
            key={type}
            pressed={type === value}
            onPressedChange={() => onChange(type)}
            icon={<WorkoutTypeIcon type={type} />}
          >
            {WORKOUT_TYPE_LABELS[type]}
          </ToggleChip>
        ))}
      </div>
      <p className="text-xs text-text-muted" aria-live="polite">
        {hint}
      </p>
    </fieldset>
  )
}
