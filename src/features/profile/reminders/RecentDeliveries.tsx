import { useRemindersStore } from '@/stores/remindersStore'
import type { ReminderSchedule } from '@/types'
import { formatTime } from '@/lib/format'
import { deliveryText, reminderTitle } from './labels'

/** The last few reminder emails the server handled (newest first). */
export function RecentDeliveries({ schedules }: { schedules: readonly ReminderSchedule[] }) {
  const deliveries = useRemindersStore((s) => s.deliveries)
  if (deliveries.length === 0) return null
  const byId = new Map(schedules.map((schedule) => [schedule.id, schedule]))
  return (
    <div className="mt-4 rounded-field bg-surface-2 px-3 py-2.5">
      <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted">Recent emails</h3>
      <ul aria-label="Recent reminder emails" className="mt-1.5 space-y-1 text-sm">
        {deliveries.slice(0, 5).map((delivery) => {
          const schedule = byId.get(delivery.scheduleId)
          return (
            <li key={delivery.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-text">
                {schedule ? reminderTitle(schedule) : 'Reminder'} · {delivery.localDate.slice(5).split('-').reverse().join('/')} {formatTime(delivery.dueAt)}
              </span>
              <span className="shrink-0 text-text-muted">{deliveryText(delivery)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
