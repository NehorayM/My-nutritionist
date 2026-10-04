import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  HeartPulse,
  SportShoe,
  StretchHorizontal,
  Volleyball,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/components/ui'
import type { WorkoutType } from '@/types'

const ICONS: Record<WorkoutType, LucideIcon> = {
  strength: Dumbbell,
  cardio: HeartPulse,
  hiit: Zap,
  walk: Footprints,
  run: SportShoe,
  cycling: Bike,
  swimming: Waves,
  mobility: StretchHorizontal,
  sports: Volleyball,
  other: Activity,
}

interface WorkoutTypeIconProps {
  type: WorkoutType
  className?: string
}

/** Decorative icon for a workout type. */
export function WorkoutTypeIcon({ type, className }: WorkoutTypeIconProps) {
  const Icon = ICONS[type]
  return <Icon aria-hidden="true" className={className} />
}

/** Round icon tile used at the start of list rows. */
export function WorkoutTypeBadge({ type, muted = false }: { type: WorkoutType; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5',
        muted ? 'bg-surface-2 text-text-muted' : 'bg-primary/10 text-primary',
      )}
    >
      <WorkoutTypeIcon type={type} />
    </span>
  )
}
