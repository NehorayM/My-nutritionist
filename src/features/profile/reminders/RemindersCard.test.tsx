import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/Toaster'
import { UnsubscribePage } from '@/features/reminders/UnsubscribePage'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { notify } from '@/lib/notify'
import { createLocalRepositories } from '@/repositories'
import * as reminderService from '@/services/reminders'
import { getRepositories, setRepositories } from '@/services/runtime'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { registerMealsTestHooks } from '@/features/meals/testing/mealsHarness'
import { RemindersCard } from './RemindersCard'

// Radix sheets need pointer-capture stubs in jsdom.
registerMealsTestHooks()

function renderCard() {
  const user = userEvent.setup({ delay: null })
  render(
    <>
      <RemindersCard />
      <Toaster />
    </>,
  )
  return user
}

beforeEach(async () => {
  await deleteDatabase()
  const userId = newId()
  setRepositories(createLocalRepositories(userId))
  resetUserStores()
  useSessionStore.setState({ phase: 'ready', mode: 'cloud', userId, email: 'noa@example.com', passwordRecovery: false })
  vi.spyOn(reminderService, 'listRecentDeliveries').mockResolvedValue([])
})

afterEach(() => {
  act(() => notify.dismiss())
  setRepositories(null)
})

describe('Email reminders card', () => {
  it('asks guests to sign in', () => {
    useSessionStore.setState({ mode: 'guest' })
    renderCard()
    expect(screen.getByText(/Sign in to get reminders by email/)).toBeInTheDocument()
  })

  it('adds the suggested set, toggles and deletes a reminder with Undo', async () => {
    const user = renderCard()
    await user.click(await screen.findByRole('button', { name: 'Add suggested reminders' }))
    const list = await screen.findByRole('list', { name: 'Reminders' })
    await vi.waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4))
    expect(within(list).getByRole('switch', { name: /Log lunch · 13:00/ })).toBeChecked()
    await user.click(within(list).getByRole('switch', { name: /Log lunch · 13:00/ }))
    await vi.waitFor(async () => expect((await getRepositories().reminders.list()).find((s) => s.mealType === 'lunch')?.enabled).toBe(false))
    await user.click(within(list).getByRole('button', { name: 'Delete Log dinner' }))
    await vi.waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await vi.waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4))
  })

  it('creates a custom reminder with days and time', async () => {
    const user = renderCard()
    await user.click(await screen.findByRole('button', { name: 'Add reminder' }))
    const sheet = screen.getByRole('dialog', { name: 'New email reminder' })
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Reminder' }), 'hydration')
    for (const day of ['Fri', 'Sat']) await user.click(within(sheet).getByRole('button', { name: day }))
    await user.click(within(sheet).getByRole('button', { name: 'Add reminder' }))
    const list = await screen.findByRole('list', { name: 'Reminders' })
    expect(within(list).getByRole('switch', { name: /Drink water · 10:30/ })).toBeInTheDocument()
    expect((await getRepositories().reminders.list())[0]).toMatchObject({ kind: 'hydration', mealType: null, days: [0, 1, 2, 3, 4] })
  })

  it('sends a test email and reports problems', async () => {
    const send = vi.spyOn(reminderService, 'sendTestEmail').mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, message: 'Email delivery isn’t set up on the server yet.' })
    const user = renderCard()
    await user.click(await screen.findByRole('button', { name: 'Send test email' }))
    expect(await screen.findByText('Test email sent')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send test email' }))
    expect(await screen.findByText('Email delivery isn’t set up on the server yet.')).toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('shows recent deliveries in plain words', async () => {
    const created = await getRepositories().reminders.save({ id: newId(), userId: getRepositories().userId, kind: 'meal_log', mealType: 'dinner', localTime: '19:30', days: [1], timezone: 'UTC', enabled: true, skipIfLogged: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })
    vi.spyOn(reminderService, 'listRecentDeliveries').mockResolvedValue([
      { id: newId(), scheduleId: created.id, localDate: '2026-10-12', dueAt: '2026-10-12T19:30:00.000Z', status: 'skipped', detail: 'already_logged', updatedAt: '2026-10-12T19:31:00.000Z' },
    ])
    renderCard()
    const recent = await screen.findByRole('list', { name: 'Recent reminder emails' })
    expect(recent).toHaveTextContent(/Log dinner · 12\/10.*skipped — already logged/)
  })
})

describe('Unsubscribe page', () => {
  it('turns off one reminder or all of them from the email link', async () => {
    const unsubscribe = vi.spyOn(reminderService, 'unsubscribe').mockResolvedValueOnce({ ok: false, message: 'This unsubscribe link is not valid.' }).mockResolvedValueOnce({ ok: true })
    const user = userEvent.setup({ delay: null })
    render(<UnsubscribePage token="t.o.k" />)
    await user.click(screen.getByRole('button', { name: 'Turn off this reminder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This unsubscribe link is not valid.')
    await user.click(screen.getByRole('button', { name: 'Turn off all reminders' }))
    expect(await screen.findByRole('heading', { name: 'All reminders are off' })).toBeInTheDocument()
    expect(unsubscribe).toHaveBeenLastCalledWith('t.o.k', 'all')
  })
})
