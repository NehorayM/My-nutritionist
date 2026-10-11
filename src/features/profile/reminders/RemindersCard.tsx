import { BellRing, MailCheck, Plus, Sparkles } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { notify } from '@/lib/notify'
import { sendTestEmail } from '@/services/reminders'
import { useRemindersStore } from '@/stores/remindersStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { ReminderSchedule } from '@/types'
import { RecentDeliveries } from './RecentDeliveries'
import { ReminderRow } from './ReminderRow'
import { ReminderSheet } from './ReminderSheet'
import { suggestedReminders } from './reminderForm'
import { reminderTitle } from './labels'

/** Email reminders (signed-in users): schedules, a test email and what was sent recently. */
export function RemindersCard() {
  const mode = useSessionStore((s) => s.mode)
  const headingId = useId()
  return (
    <Card as="section" aria-labelledby={headingId}>
      <CardHeader>
        <CardTitle as="h2" id={headingId}>
          Email reminders
        </CardTitle>
        <CardDescription>Gentle nudges to log meals, drink water, plan meals or weigh in.</CardDescription>
      </CardHeader>
      {mode === 'cloud' ? (
        <SignedInReminders />
      ) : (
        <CardContent>
          <p className="rounded-field bg-surface-2 px-3 py-2.5 text-sm text-text">Sign in to get reminders by email — they’re sent from the server, even when the app is closed.</p>
        </CardContent>
      )}
    </Card>
  )
}

function SignedInReminders() {
  const schedules = useRemindersStore((s) => s.schedules)
  const status = useRemindersStore((s) => s.status)
  const error = useRemindersStore((s) => s.error)
  const [sheet, setSheet] = useState<{ open: boolean; schedule: ReminderSchedule | null; key: number }>({ open: false, schedule: null, key: 0 })
  const [testing, setTesting] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    void useRemindersStore.getState().load()
    void useRemindersStore.getState().loadDeliveries()
  }, [])

  const open = (schedule: ReminderSchedule | null) => setSheet((current) => ({ open: true, schedule, key: current.key + 1 }))

  async function remove(schedule: ReminderSchedule) {
    const result = await useRemindersStore.getState().remove(schedule.id)
    if (!result.ok) notify.error(result.message)
    else notify.success(`Deleted “${reminderTitle(schedule)}”`, { undo: () => void useRemindersStore.getState().restore(result.value) })
  }

  async function addSuggested() {
    setAdding(true)
    for (const input of suggestedReminders()) {
      const result = await useRemindersStore.getState().save(input)
      if (!result.ok) {
        notify.error(result.message)
        break
      }
    }
    setAdding(false)
  }

  async function test() {
    setTesting(true)
    const result = await sendTestEmail()
    setTesting(false)
    if (result.ok) notify.success('Test email sent', { description: 'Check your inbox (and the spam folder) in a minute.' })
    else notify.error(result.message)
  }

  return (
    <>
      <CardContent className="pt-2">
        {status === 'error' ? (
          <ErrorState title="Couldn’t load your reminders" description={error ?? undefined} onRetry={() => void useRemindersStore.getState().load({ force: true })} />
        ) : status !== 'ready' ? (
          <LoadingState label="Loading reminders…" className="py-6" />
        ) : schedules.length === 0 ? (
          <EmptyState
            compact
            icon={<BellRing />}
            title="No reminders yet"
            description="Start with a suggested set — breakfast, lunch, dinner and an evening planning nudge — or add your own."
            actions={
              <Button leadingIcon={<Sparkles />} loading={adding} onClick={() => void addSuggested()}>
                Add suggested reminders
              </Button>
            }
          />
        ) : (
          <ul aria-label="Reminders" className="divide-y divide-border/60">
            {schedules.map((schedule) => (
              <ReminderRow
                key={schedule.id}
                schedule={schedule}
                onToggle={(enabled) => void useRemindersStore.getState().setEnabled(schedule.id, enabled).then((r) => (r.ok ? undefined : notify.error(r.message)))}
                onEdit={() => open(schedule)}
                onRemove={() => void remove(schedule)}
              />
            ))}
          </ul>
        )}
        <RecentDeliveries schedules={schedules} />
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="secondary" leadingIcon={<Plus />} onClick={() => open(null)}>
          Add reminder
        </Button>
        <Button size="sm" variant="ghost" leadingIcon={<MailCheck />} loading={testing} onClick={() => void test()}>
          Send test email
        </Button>
      </CardFooter>
      <ReminderSheet key={`reminder-${sheet.key}`} open={sheet.open} schedule={sheet.schedule} onOpenChange={(next) => setSheet((current) => ({ ...current, open: next }))} />
    </>
  )
}
