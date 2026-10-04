import { CalendarClock, CircleCheck, SkipForward } from 'lucide-react'
import { useId } from 'react'
import { Badge, Button, Card, EmptyState, SectionHeader } from '@/components/ui'
import { formatDateLabel, formatDuration } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useActivityStore } from '@/stores/activityStore'
import type { ScheduledWorkout } from '@/types'
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '../model/labels'
import { WorkoutTypeBadge } from './WorkoutTypeIcon'

interface ScheduledSectionProps {
  today: string
  onComplete: (session: ScheduledWorkout) => void
}

async function skip(session: ScheduledWorkout) {
  const result = await useActivityStore.getState().dismissScheduled(session.id)
  if (!result.ok) {
    notify.error(result.message)
    return
  }
  notify.info('Session skipped', {
    id: `skip-${session.id}`,
    undo: () => {
      void useActivityStore.getState().restoreScheduled(session)
    },
  })
}

function SessionRow({ session, today, onComplete }: { session: ScheduledWorkout } & ScheduledSectionProps) {
  const done = session.status === 'completed'
  const day = formatDateLabel(session.date, today)
  const type = WORKOUT_TYPE_LABELS[session.type]
  const details = [formatDuration(session.durationMin), session.intensity ? INTENSITY_LABELS[session.intensity] : null]
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <WorkoutTypeBadge type={session.type} muted={done} />
      <div className="min-w-[9rem] flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-accent-ink">{day}</p>
        <p className="truncate font-semibold text-text">{type}</p>
        <p className="text-sm text-text-muted">{details.filter(Boolean).join(' · ')}</p>
      </div>
      {done ? (
        <Badge tone="success" icon={<CircleCheck />}>
          Done
        </Badge>
      ) : (
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<SkipForward />}
            aria-label={`Skip ${type.toLowerCase()} session on ${day}`}
            onClick={() => void skip(session)}
          >
            Skip
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<CircleCheck />}
            aria-label={`Complete ${type.toLowerCase()} session on ${day}`}
            onClick={() => onComplete(session)}
          >
            Complete
          </Button>
        </div>
      )}
    </li>
  )
}

/** This week's scheduled (accepted catch-up) sessions: open ones can be completed or skipped. */
export function ScheduledSection({ today, onComplete }: ScheduledSectionProps) {
  const titleId = useId()
  const scheduled = useActivityStore((s) => s.scheduled)
  const visible = scheduled.filter((session) => session.status !== 'dismissed')
  const open = visible.filter((session) => session.status === 'planned')
  const doneCount = visible.length - open.length
  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <SectionHeader
        id={titleId}
        title="Scheduled sessions"
        description={visible.length > 0 ? `${open.length} open · ${doneCount} done` : undefined}
      />
      {visible.length === 0 ? (
        <Card variant="flat">
          <EmptyState
            compact
            icon={<CalendarClock />}
            title="Nothing scheduled yet"
            description="Accept a Smart Catch-Up suggestion to plan the rest of your week."
          />
        </Card>
      ) : (
        <Card as="div">
          <ul className="divide-y divide-border/70">
            {visible.map((session) => (
              <SessionRow key={session.id} session={session} today={today} onComplete={onComplete} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
