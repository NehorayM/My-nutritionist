import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, ConfirmDialog, SectionHeader } from '@/components/ui'
import { formatDateLabel, formatTime, formatWeight } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useWeightStore } from '@/stores/weightStore'
import type { UnitSystem, WeightEntry } from '@/types'
import { groupHistory } from '../lib/history'
import { EditWeighInSheet } from './EditWeighInSheet'
import { HistoryDayGroup } from './HistoryDayGroup'

const INITIAL_DAYS = 7
const MORE_DAYS = 14

interface HistorySectionProps {
  entries: readonly WeightEntry[]
  unitSystem: UnitSystem
  today: string
}

/** Weigh-in history grouped by day, with edit (sheet) and delete (confirm + Undo). */
export function HistorySection({ entries, unitSystem, today }: HistorySectionProps) {
  const remove = useWeightStore((s) => s.remove)
  const restore = useWeightStore((s) => s.restore)
  const days = useMemo(() => groupHistory(entries), [entries])
  const [visibleDays, setVisibleDays] = useState(INITIAL_DAYS)
  const [editing, setEditing] = useState<WeightEntry | null>(null)
  const [deleting, setDeleting] = useState<WeightEntry | null>(null)

  function describe(entry: WeightEntry): string {
    return `${formatWeight(entry.weightKg, unitSystem)} · ${formatDateLabel(entry.date, today)}, ${formatTime(entry.measuredAt)}`
  }

  async function confirmDelete(entry: WeightEntry) {
    const result = await remove(entry.id)
    if (!result.ok) {
      notify.error(result.message)
      throw new Error(result.message)
    }
    notify.success('Weigh-in deleted', {
      description: describe(entry),
      undo: () => {
        void restore(entry).then((restored) => {
          if (restored.ok) notify.success('Weigh-in restored')
          else notify.error(restored.message)
        })
      },
    })
  }

  const hidden = days.length - visibleDays
  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <SectionHeader id="history-title" title="History" description="Newest first. Edit or delete any weigh-in." />
      <ul className="space-y-4">
        {days.slice(0, visibleDays).map((day) => (
          <HistoryDayGroup
            key={day.date}
            day={day}
            today={today}
            unitSystem={unitSystem}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <Button
          variant="secondary"
          fullWidth
          leadingIcon={<ChevronDown />}
          onClick={() => setVisibleDays((count) => count + MORE_DAYS)}
        >
          {`Show earlier days (${hidden} more)`}
        </Button>
      ) : null}

      <EditWeighInSheet entry={editing} unitSystem={unitSystem} today={today} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this weigh-in?"
        description={deleting ? `${describe(deleting)}. You can undo this right after.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => (deleting ? confirmDelete(deleting) : undefined)}
      />
    </section>
  )
}
