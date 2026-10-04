import { Dumbbell, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, Card, ConfirmDialog, EmptyState, SectionHeader } from '@/components/ui'
import { formatDateLabel, formatDuration } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useActivityStore } from '@/stores/activityStore'
import type { WorkoutEntry } from '@/types'
import { plural, WORKOUT_TYPE_LABELS } from '../model/labels'
import { WorkoutRow } from './WorkoutRow'

interface WorkoutsSectionProps {
  /** This week's workouts, oldest first (from the weekly progress). */
  workouts: readonly WorkoutEntry[]
  today: string
  onLog: () => void
  onEdit: (workout: WorkoutEntry) => void
}

/** This week's logged workouts, newest first; delete asks first and still offers Undo. */
export function WorkoutsSection({ workouts, today, onLog, onEdit }: WorkoutsSectionProps) {
  const titleId = useId()
  const [pending, setPending] = useState<WorkoutEntry | null>(null)
  const newestFirst = [...workouts].reverse()

  async function confirmDelete() {
    if (!pending) return
    const removed = pending
    const result = await useActivityStore.getState().deleteWorkout(removed.id)
    if (!result.ok) {
      notify.error(result.message)
      throw new Error(result.message)
    }
    notify.success('Workout deleted', {
      id: `delete-${removed.id}`,
      undo: () => {
        void useActivityStore.getState().restoreWorkout(removed).then((restored) => {
          if (!restored.ok) notify.error(restored.message)
        })
      },
    })
  }

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <SectionHeader
        id={titleId}
        title="Workouts this week"
        description={workouts.length > 0 ? plural(workouts.length, 'workout') + ' logged' : undefined}
        action={
          workouts.length > 0 ? (
            <Button variant="subtle" size="sm" leadingIcon={<Plus />} onClick={onLog}>
              Log workout
            </Button>
          ) : undefined
        }
      />
      {workouts.length === 0 ? (
        <Card variant="flat">
          <EmptyState
            compact
            icon={<Dumbbell />}
            title="No workouts logged this week"
            description="Strength, cardio, a walk or a stretch: log it here to follow your weekly plan."
            actions={
              <Button size="sm" leadingIcon={<Plus />} onClick={onLog}>
                Log workout
              </Button>
            }
          />
        </Card>
      ) : (
        <Card as="div">
          <ul className="divide-y divide-border/70">
            {newestFirst.map((workout) => (
              <WorkoutRow key={workout.id} workout={workout} today={today} onEdit={onEdit} onDelete={setPending} />
            ))}
          </ul>
        </Card>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title="Delete this workout?"
        description={
          pending
            ? `${WORKOUT_TYPE_LABELS[pending.type]} · ${formatDuration(pending.durationMin)} · ${formatDateLabel(pending.date, today)}. You can undo right after.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </section>
  )
}
