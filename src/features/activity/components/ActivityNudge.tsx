import { Bell, Plus } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { WeeklyActivityProgress } from '@/domain/activity'
import { daysLeftText, plural } from '../model/labels'

interface ActivityNudgeProps {
  progress: WeeklyActivityProgress
  onLog: () => void
}

/** In-app reminder (Profile → reminders → activity) shown while planned sessions remain this week. */
export function ActivityNudge({ progress, onLog }: ActivityNudgeProps) {
  const remaining = progress.totalRemaining
  return (
    <Card variant="tinted" role="note" aria-label="Activity reminder" className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary [&_svg]:size-4">
        <Bell />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{plural(remaining, 'session')} to go</p>
        <p className="text-xs text-text-muted">{daysLeftText(progress.week.daysRemaining)}</p>
      </div>
      <Button size="sm" variant="secondary" leadingIcon={<Plus />} onClick={onLog} aria-label="Log a workout">
        Log
      </Button>
    </Card>
  )
}
