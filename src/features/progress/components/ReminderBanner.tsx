import { Scale, X } from 'lucide-react'
import { Button, Card, IconButton } from '@/components/ui'

interface ReminderBannerProps {
  onLog: () => void
  onHide: () => void
}

/** Gentle in-app nudge when weigh-in reminders are on and today has no weigh-in yet. */
export function ReminderBanner({ onLog, onHide }: ReminderBannerProps) {
  return (
    <Card as="section" variant="tinted" aria-labelledby="reminder-title" className="flex items-start gap-3 py-3 pl-4 pr-2">
      <span aria-hidden="true" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
        <Scale className="size-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h2 id="reminder-title" className="text-[0.9375rem] font-bold text-text">
            No weigh-in yet today
          </h2>
          <p className="text-sm text-text-muted">A quick one keeps your trend current — whenever suits you.</p>
        </div>
        <Button size="sm" onClick={onLog}>
          Log today’s weight
        </Button>
      </div>
      <IconButton label="Hide reminder for now" icon={<X />} size="sm" onClick={onHide} />
    </Card>
  )
}
