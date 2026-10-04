import { SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ProgressBar, Stat } from '@/components/ui'
import type { CategoryProgress, WeeklyActivityProgress } from '@/domain/activity'
import { formatDuration } from '@/lib/format'
import type { Profile } from '@/types'
import { ADHERENCE_COPY, CATEGORY_LABELS, CATEGORY_TONES, formatWeekRange, plural } from '../model/labels'

interface WeeklyProgressCardProps {
  progress: WeeklyActivityProgress
  profile: Profile
  onEditPlan: () => void
}

function CategoryRow({ entry }: { entry: CategoryProgress }) {
  const label = CATEGORY_LABELS[entry.category]
  const noun = `${entry.category} ${entry.planned === 1 ? 'session' : 'sessions'}`
  if (entry.planned === 0) {
    return (
      <li className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-text">{label}</span>
        <span className="text-text-muted">
          {entry.completed > 0 ? `${plural(entry.completed, 'session')} done · not in this week's plan` : 'Not in your plan'}
        </span>
      </li>
    )
  }
  const status = entry.remaining === 0 ? 'Done' : `${entry.remaining} left`
  return (
    <li>
      <ProgressBar
        value={entry.completed}
        max={entry.planned}
        tone={CATEGORY_TONES[entry.category]}
        label={label}
        valueText={`${entry.completed} of ${entry.planned} ${noun} done${entry.remaining > 0 ? `, ${entry.remaining} left` : ''}`}
        caption={
          <div className="flex items-baseline justify-between gap-3 text-sm" aria-hidden="true">
            <span className="font-semibold text-text">{label}</span>
            <span className="tabular-nums text-text-muted">
              <span className="font-semibold text-text">{entry.completed}</span> of {entry.planned} · {status}
            </span>
          </div>
        }
      />
    </li>
  )
}

/** "1 h 35 min" with smaller units, so weekly totals fit a narrow stat column on one line. */
function DurationValue({ minutes }: { minutes: number }) {
  return (
    <span className="whitespace-nowrap">
      {formatDuration(minutes)
        .split(' ')
        .map((part, index) =>
          /^\d+$/.test(part) ? (
            <span key={index}>{index > 0 ? ' ' : null}{part}</span>
          ) : (
            <span key={index} className="ml-0.5 text-[0.6em] font-semibold text-text-muted">
              {part}
            </span>
          ),
        )}
    </span>
  )
}

/** Weekly progress per category against the user's own plan, with neutral, encouraging wording. */
export function WeeklyProgressCard({ progress, profile, onEditPlan }: WeeklyProgressCardProps) {
  const titleId = useId()
  const { week } = progress
  const credited = progress.totalPlanned - progress.totalRemaining
  return (
    <Card as="section" aria-labelledby={titleId}>
      <CardHeader
        action={
          <Button variant="subtle" size="sm" leadingIcon={<SlidersHorizontal />} onClick={onEditPlan}>
            Edit plan
          </Button>
        }
      >
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent-ink">{formatWeekRange(week.start, week.end)}</p>
        <CardTitle as="h2" id={titleId} className="text-lg">
          This week
        </CardTitle>
        <CardDescription aria-live="polite">{ADHERENCE_COPY[progress.adherence]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-4">
          {progress.categories.map((entry) => (
            <CategoryRow key={entry.category} entry={entry} />
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-3 rounded-card bg-surface-2 px-4 py-3">
          <Stat
            size="sm"
            label="Sessions"
            value={progress.totalPlanned > 0 ? `${credited} of ${progress.totalPlanned}` : String(progress.totalCompleted)}
            hint="done"
          />
          <Stat size="sm" label="Active time" value={<DurationValue minutes={progress.totalMinutes} />} hint={plural(progress.workouts.length, 'workout')} />
          <Stat size="sm" label="Days left" value={String(week.daysRemaining)} hint={week.daysRemaining <= 1 ? 'last day' : 'incl. today'} />
        </div>
        <p className="text-sm text-text-muted">
          Your plan: {plural(profile.strengthSessionsPerWeek, 'strength session')} and{' '}
          {plural(profile.cardioSessionsPerWeek, 'cardio session')} a week, about {formatDuration(profile.preferredWorkoutMinutes)} each.
        </p>
      </CardContent>
    </Card>
  )
}
