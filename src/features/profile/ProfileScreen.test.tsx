import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Toaster } from '@/components/ui/Toaster'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import { loadSharedData } from '@/services/session/sharedData'
import { useProfileStore } from '@/stores/profileStore'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { ProfileScreen } from './ProfileScreen'

const userId = newId()

async function renderProfile() {
  const user = userEvent.setup()
  render(
    <>
      <ProfileScreen />
      <Toaster />
    </>,
  )
  await screen.findByRole('heading', { name: 'Personal Profile' })
  return user
}

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(createLocalRepositories(userId))
  resetUserStores()
  useSessionStore.setState({ phase: 'ready', mode: 'guest', userId, email: null })
  useSyncStore.setState({ connection: 'unconfigured', sync: null, guestImport: null })
  loadSharedData()
})

afterEach(() => setRepositories(null))

describe('Profile screen in guest mode', () => {
  it('states that data is stored locally and offers no cloud claims', async () => {
    await renderProfile()
    const account = screen.getByRole('region', { name: 'Running in Offline/Local Mode' })
    expect(within(account).getByText(/stored only on this device/i)).toBeInTheDocument()
    expect(screen.queryByText('Connected to Supabase')).not.toBeInTheDocument()
    expect(screen.getByText(/general wellness targets are used/i)).toBeInTheDocument()
  })

  it('saves the Personal Profile and switches targets to a personalized estimate', async () => {
    const user = await renderProfile()
    const form = screen.getByRole('region', { name: 'Personal Profile' })
    await user.type(within(form).getByLabelText(/birth date/i), '1990-04-12')
    await user.selectOptions(within(form).getByLabelText('Sex'), 'female')
    await user.type(within(form).getByLabelText(/height/i), '165')
    await user.type(within(form).getByLabelText(/current weight/i), '62')
    await user.click(within(form).getByRole('button', { name: 'Save Personal Profile' }))

    expect(await screen.findByText('Personal Profile saved')).toBeInTheDocument()
    const stored = await getRepositories().profile.get()
    expect(stored).toMatchObject({ birthDate: '1990-04-12', sex: 'female', heightCm: 165, currentWeightKg: 62 })
    expect(await screen.findByText(/Personalized estimate/)).toBeInTheDocument()
  })

  it('shows field errors for out-of-range values and does not save', async () => {
    const user = await renderProfile()
    const form = screen.getByRole('region', { name: 'Personal Profile' })
    await user.type(within(form).getByLabelText(/height/i), '20')
    await user.click(within(form).getByRole('button', { name: 'Save Personal Profile' }))
    expect(within(form).getByText(/between 50 and 272 cm/)).toBeInTheDocument()
    expect(await getRepositories().profile.get()).toBeNull()
  })

  it('stores imperial height and weight in metric units', async () => {
    const user = await renderProfile()
    await user.click(screen.getByRole('radio', { name: 'Imperial (lb, ft)' }))
    await screen.findByLabelText(/height \(ft\)/i)
    const form = screen.getByRole('region', { name: 'Personal Profile' })
    await user.type(within(form).getByLabelText(/height \(ft\)/i), '5')
    await user.type(within(form).getByLabelText('Inches'), '11')
    await user.type(within(form).getByLabelText(/current weight/i), '154')
    await user.click(within(form).getByRole('button', { name: 'Save Personal Profile' }))
    await screen.findByText('Personal Profile saved')
    const stored = await getRepositories().profile.get()
    expect(stored?.unitSystem).toBe('imperial')
    expect(stored?.heightCm).toBeCloseTo(180.3, 1)
    expect(stored?.currentWeightKg).toBeCloseTo(69.85, 1)
  })

  it('saves food preferences: allergies, dislikes and cuisines', async () => {
    const user = await renderProfile()
    const form = screen.getByRole('region', { name: 'Food preferences' })
    await user.selectOptions(within(form).getByLabelText('Eating pattern'), 'vegetarian')
    await user.click(within(form).getByRole('button', { name: 'Sesame' }))
    await user.type(within(form).getByLabelText(/rather skip/i), 'olives{Enter}')
    await user.click(within(form).getByRole('button', { name: 'Israeli' }))
    await user.click(within(form).getByRole('button', { name: 'Save food preferences' }))
    await screen.findByText('Food preferences saved')
    expect(await getRepositories().profile.get()).toMatchObject({
      dietType: 'vegetarian',
      allergies: ['sesame'],
      dislikes: ['olives'],
      preferredCuisines: ['israeli'],
    })
    await user.click(within(form).getByRole('button', { name: 'Remove olives' }))
    expect(within(form).queryByText('olives')).not.toBeInTheDocument()
  })

  it('applies reminder toggles immediately', async () => {
    const user = await renderProfile()
    await user.click(screen.getByRole('switch', { name: /morning weigh-in reminder/i }))
    await expect.poll(async () => (await getRepositories().profile.get())?.reminders.weighIn).toBe(false)
  })

  it('clears guest data on this device after confirmation', async () => {
    const user = await renderProfile()
    const profile = useProfileStore.getState().profile!
    await useProfileStore.getState().save({ ...profile, displayName: 'Dana' })
    await user.click(screen.getByRole('button', { name: 'Clear data on this device' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear data' }))
    await screen.findByText('Data on this device was cleared')
    expect(await getRepositories().profile.get()).toBeNull()
  })
})
