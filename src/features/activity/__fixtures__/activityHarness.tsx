import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest'
import { Toaster } from '@/components/ui'
import { createDefaultProfile } from '@/domain/profile'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { notify } from '@/lib/notify'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useActivityStore, type WorkoutInput } from '@/stores/activityStore'
import { useProfileStore } from '@/stores/profileStore'
import { resetUserStores } from '@/stores/registry'
import { resetUiStore } from '@/stores/uiStore'
import type { Profile } from '@/types'
import { ActivityScreen } from '../ActivityScreen'

/** Wednesday 2026-10-07, 9:00 local; the Monday-start week runs 2026-10-05 … 2026-10-11. */
export const TODAY = '2026-10-07'
export const MONDAY = '2026-10-05'

const POINTER_CAPTURE = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const

/** Registers per-file hooks: fixed local time, jsdom pointer-capture stubs (sonner), cleanup. */
export function registerActivityTestHooks(): void {
  const missing = POINTER_CAPTURE.filter((name) => !(name in Element.prototype))
  beforeAll(() => {
    for (const name of missing) Object.defineProperty(Element.prototype, name, { value: () => false, configurable: true, writable: true })
  })
  afterAll(() => {
    for (const name of missing) Reflect.deleteProperty(Element.prototype, name)
  })
  afterEach(() => {
    act(() => notify.dismiss())
    setRepositories(null)
    vi.useRealTimers()
  })
}

/** Fresh local repositories with a saved profile (2 strength + 2 cardio, 70 kg) loaded into the stores. */
export async function setupActivity(overrides: Partial<Profile> = {}): Promise<Profile> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0))
  await deleteDatabase()
  const userId = newId()
  setRepositories(createLocalRepositories(userId))
  resetUserStores()
  resetUiStore()
  const profile: Profile = { ...createDefaultProfile(userId, new Date().toISOString()), currentWeightKg: 70, ...overrides }
  await getRepositories().profile.save(profile)
  await useProfileStore.getState().load()
  return profile
}

/** Saves a weigh-in in the repository; the Activity screen loads weigh-ins itself. */
export async function seedWeighIn(date: string, weightKg: number): Promise<void> {
  const repos = getRepositories()
  const at = new Date().toISOString()
  await repos.weights.save({ id: newId(), userId: repos.userId, date, measuredAt: at, weightKg, inputUnit: 'kg', note: null, createdAt: at, updatedAt: at })
}

/** Logs a workout through the store (test setup for data that exists before the screen opens). */
export async function seedWorkout(input: Partial<WorkoutInput> & Pick<WorkoutInput, 'date' | 'type'>): Promise<void> {
  await useActivityStore.getState().load(TODAY, 1)
  const result = await useActivityStore
    .getState()
    .logWorkout({ durationMin: 40, intensity: 'moderate', kcal: null, notes: null, weightKg: 70, ...input })
  if (!result.ok) throw new Error(result.message)
}

export async function renderActivity() {
  const user = userEvent.setup()
  render(
    <>
      <ActivityScreen />
      <Toaster />
    </>,
  )
  await screen.findByRole('heading', { level: 2, name: 'This week' })
  return { user }
}

export function section(name: string): HTMLElement {
  return screen.getByRole('region', { name })
}

export function progressValue(category: 'Strength' | 'Cardio'): string | null {
  return within(section('This week')).getByRole('progressbar', { name: category }).getAttribute('aria-valuetext')
}

/** Matches a paragraph by its full text, even when parts of it sit in separate spans. */
export function paragraph(text: string) {
  return (_content: string, element: Element | null) => element?.tagName === 'P' && element.textContent === text
}

/** Waits until no dialog is open, so the page is no longer aria-hidden behind it. */
export async function dialogsClosed(): Promise<void> {
  await waitFor(() => expect(screen.queryAllByRole('dialog').concat(screen.queryAllByRole('alertdialog'))).toEqual([]))
}
