import { Bell, Droplets, NotebookPen, Pencil, Scale, Trash2, type LucideIcon } from 'lucide-react'
import { IconButton, Switch } from '@/components/ui'
import type { ReminderKind, ReminderSchedule } from '@/types'
import { daysText, reminderTitle } from './labels'

const ICONS: Record<ReminderKind, LucideIcon> = { meal_log: NotebookPen, hydration: Droplets, planning: Bell, weigh_in: Scale }

interface ReminderRowProps {
  schedule: ReminderSchedule
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onRemove: () => void
}

export function ReminderRow({ schedule, onToggle, onEdit, onRemove }: ReminderRowProps) {
  const Icon = ICONS[schedule.kind]
  const title = reminderTitle(schedule)
  return (
    <li className="flex items-center gap-3 py-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <Switch
          checked={schedule.enabled}
          onCheckedChange={onToggle}
          label={
            <span className="font-semibold">
              {title} · {schedule.localTime}
            </span>
          }
          description={`${daysText(schedule.days)} · ${schedule.timezone.replace(/_/g, ' ')}`}
        />
      </div>
      <div className="-mr-2 flex shrink-0">
        <IconButton label={`Edit ${title}`} icon={<Pencil />} size="sm" onClick={onEdit} />
        <IconButton label={`Delete ${title}`} icon={<Trash2 />} size="sm" onClick={onRemove} />
      </div>
    </li>
  )
}
