import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordRecoveryDialog } from '@/app/PasswordRecoveryDialog'
import { Toaster } from '@/components/ui/Toaster'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { notify } from '@/lib/notify'
import { createLocalRepositories } from '@/repositories/local'
import { setRepositories } from '@/services/runtime'
import { session } from '@/services/session'
import { emptyCounts } from '@/services/migration'
import { loadSharedData } from '@/services/session/sharedData'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { AccountCard } from './components/AccountCard'
import { GuestImportCard } from './components/DataCards'

const userId = newId()
const status = { state: 'error' as const, pending: 2, failed: 1, lastSyncedAt: '2026-10-05T07:30:00.000Z', lastError: 'One change was rejected.' }

function renderWithToasts(ui: React.ReactNode) {
  const user = userEvent.setup()
  render(
    <>
      {ui}
      <Toaster />
    </>,
  )
  return user
}

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(createLocalRepositories(userId))
  resetUserStores()
  loadSharedData()
  useSessionStore.setState({ phase: 'ready', mode: 'cloud', userId, email: 'dana@example.com', passwordRecovery: false })
  useSyncStore.setState({ connection: 'connected', sync: status, guestImport: null, importing: false })
})

afterEach(() => {
  act(() => notify.dismiss())
  setRepositories(null)
})

describe('Account card in cloud mode', () => {
  it('shows the verified connection, pending count and failed changes', () => {
    renderWithToasts(<AccountCard />)
    const card = screen.getByRole('region', { name: 'Connected to Supabase' })
    expect(within(card).getByText('Signed in as', { exact: false })).toHaveTextContent('dana@example.com')
    expect(within(card).getByText('Pending synchronization: 2')).toBeInTheDocument()
    expect(within(card).getByText("1 change couldn't sync")).toBeInTheDocument()
    expect(within(card).getByText('One change was rejected.')).toBeInTheDocument()
  })

  it('does not claim a connection while offline', () => {
    useSyncStore.setState({ connection: 'offline' })
    renderWithToasts(<AccountCard />)
    expect(screen.queryByText('Connected to Supabase')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Offline — saving on this device/ })).toBeInTheDocument()
  })

  it('retries and, after confirmation, discards failed changes', async () => {
    const retry = vi.spyOn(session(), 'retryFailedSync').mockResolvedValue(1)
    const discard = vi.spyOn(session(), 'discardFailedSync').mockResolvedValue(1)
    const user = renderWithToasts(<AccountCard />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalled()
    expect(await screen.findByText('Trying 1 change again')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(discard).toHaveBeenCalled()
    expect(await screen.findByText('1 change discarded')).toBeInTheDocument()
  })

  it('warns about unsynced changes before signing out, then signs out', async () => {
    const signOut = vi.spyOn(session(), 'signOut').mockResolvedValue({ ok: true })
    const user = renderWithToasts(<AccountCard />)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/3 changes haven't synced yet/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('checks the connection on demand', async () => {
    vi.spyOn(session(), 'verifyConnection').mockResolvedValue('offline')
    const user = renderWithToasts(<AccountCard />)
    await user.click(screen.getByRole('button', { name: 'Check connection' }))
    expect(await screen.findByText(/isn't reachable right now/)).toBeInTheDocument()
  })
})

describe('Guest import card', () => {
  it('imports guest data and reports failures', async () => {
    useSyncStore.setState({ guestImport: { guestId: newId(), total: 5, counts: { ...emptyCounts(), meals: 5 } } })
    const importGuestData = vi
      .spyOn(session(), 'importGuestData')
      .mockResolvedValueOnce({ ok: false, message: 'The server is busy. Try again.' })
      .mockResolvedValueOnce({ ok: true, imported: 5 })
    const user = renderWithToasts(<GuestImportCard />)
    expect(screen.getByRole('heading', { name: '5 items from guest mode' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import into my account' }))
    expect(await screen.findByText('The server is busy. Try again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import into my account' }))
    expect(await screen.findByText('Imported 5 items into your account')).toBeInTheDocument()
    expect(importGuestData).toHaveBeenCalledTimes(2)
  })
})

describe('Password recovery dialog', () => {
  it('asks for a strong enough new password and saves it', async () => {
    const update = vi.spyOn(session(), 'updatePassword').mockImplementation(async () => {
      useSessionStore.setState({ passwordRecovery: false })
      return { ok: true }
    })
    useSessionStore.setState({ passwordRecovery: true })
    const user = renderWithToasts(<PasswordRecoveryDialog />)
    const dialog = screen.getByRole('dialog', { name: 'Choose a new password' })
    await user.type(within(dialog).getByLabelText('New password'), 'short')
    await user.click(within(dialog).getByRole('button', { name: 'Save new password' }))
    expect(within(dialog).getByText('Use at least 8 characters.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('New password'), '-and-long')
    await user.click(within(dialog).getByRole('button', { name: 'Save new password' }))
    expect(update).toHaveBeenCalledWith('short-and-long')
    expect(await screen.findByText('Your password was updated')).toBeInTheDocument()
  })
})
