import { vi } from 'vitest'
import { EmailError, type DueReminder, type EmailMessage, type EmailSender, type ReminderStore } from '../../../../supabase/functions/reminders/types.ts'

export const USER = '2b8d6c1e-8d3a-4f2b-9c1d-2e3f4a5b6c7d'
export const SCHEDULE = '6f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f'

export function due(overrides: Partial<DueReminder> = {}): DueReminder {
  return {
    dispatchId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    scheduleId: SCHEDULE,
    userId: USER,
    email: 'noa@example.com',
    kind: 'meal_log',
    mealType: 'lunch',
    localDate: '2026-10-12',
    skipIfLogged: true,
    alreadyLogged: false,
    ...overrides,
  }
}

export function fakeStore(claimed: DueReminder[] = []) {
  const marks: { id: string; outcome: string; detail: string | null; providerMessageId: string | null }[] = []
  const store: ReminderStore = {
    claimDue: vi.fn<ReminderStore['claimDue']>(async () => claimed),
    markDispatch: vi.fn<ReminderStore['markDispatch']>(async (id, outcome, detail, providerMessageId) => {
      marks.push({ id, outcome, detail, providerMessageId })
    }),
    userEmail: vi.fn<ReminderStore['userEmail']>(async (userId) => (userId === USER ? 'noa@example.com' : null)),
    disableSchedule: vi.fn<ReminderStore['disableSchedule']>(async () => true),
    disableAllSchedules: vi.fn<ReminderStore['disableAllSchedules']>(async () => 3),
  }
  return { store, marks }
}

export function fakeSender(failWith: EmailError | null = null): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = []
  return {
    name: 'mailpit',
    minIntervalMs: 0,
    sent,
    async send(message) {
      if (failWith) throw failWith
      sent.push(message)
      return { id: `msg-${sent.length}` }
    },
  }
}
