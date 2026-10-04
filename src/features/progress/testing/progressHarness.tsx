import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { Toaster } from '@/components/ui'
import { addDays } from '@/domain/dates'
import { createDefaultProfile } from '@/domain/profile'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { notify } from '@/lib/notify'
import { createLocalRepositories } from '@/repositories'
import type { Repositories } from '@/repositories/types'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useProfileStore } from '@/stores/profileStore'
import { resetUserStores } from '@/stores/registry'
import { resetUiStore } from '@/stores/uiStore'
import { useWeightStore } from '@/stores/weightStore'
import type { Profile, WeightEntry } from '@/types'
import { ProgressScreen } from '../ProgressScreen'

/** Wednesday 2026-10-07, 7:30 local (a morning); the Monday-start week runs 2026-10-05 … 2026-10-11. */
export const TODAY = '2026-10-07'
/** An adult birth date (38 on TODAY). */
export const ADULT_BIRTH_DATE = '1988-03-14'
/** A minor's birth date (15 on TODAY). */
export const MINOR_BIRTH_DATE = '2011-05-02'

const POINTER_CAPTURE = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const

/** Registers per-file hooks: jsdom pointer-capture stubs (Radix/sonner), toast + clock cleanup. */
export function registerProgressTestHooks(): void {
  const missing = POINTER_CAPTURE.filter((name) => !(name in Element.prototype))
  beforeAll(() => {
    for (const name of missing) {
      Object.defineProperty(Element.prototype, name, { value: () => false, configurable: true, writable: true })
    }
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

/** Fixes the clock at TODAY 7:30 and installs fresh, empty local repositories (stores reset, not loaded). */
export async function freshRepositories(): Promise<Repositories> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 7, 30))
  await deleteDatabase()
  const repositories = createLocalRepositories(newId())
  setRepositories(repositories)
  resetUserStores()
  resetUiStore()
  return repositories
}

/** Fresh repositories with a saved adult metric profile, loaded into the shared stores. */
export async function setupProgress(overrides: Partial<Profile> = {}): Promise<Profile> {
  const { userId } = await freshRepositories()
  const profile: Profile = {
    ...createDefaultProfile(userId, new Date().toISOString()),
    birthDate: ADULT_BIRTH_DATE,
    heightCm: 175,
    currentWeightKg: 80,
    ...overrides,
  }
  await getRepositories().profile.save(profile)
  await useProfileStore.getState().load()
  await useWeightStore.getState().load()
  return profile
}

interface SeedWeighIn {
  date: string
  weightKg: number
  /** Local "HH:MM"; defaults to 07:00. */
  time?: string
  note?: string
}

/** Stores weigh-ins that exist before the screen opens (through the store, like the app would). */
export async function seedWeighIns(items: readonly SeedWeighIn[]): Promise<void> {
  for (const item of items) {
    const [hours, minutes] = (item.time ?? '07:00').split(':').map(Number) as [number, number]
    const [year, month, day] = item.date.split('-').map(Number) as [number, number, number]
    const result = await useWeightStore.getState().add({
      weightKg: item.weightKg,
      inputUnit: 'kg',
      date: item.date,
      measuredAt: new Date(year, month - 1, day, hours, minutes).toISOString(),
      note: item.note ?? null,
    })
    if (!result.ok) throw new Error(result.message)
  }
}

/** One morning weigh-in per day for `days` days ending TODAY, changing by `stepKg` per day. */
export async function seedDailySeries(days: number, startKg: number, stepKg: number): Promise<void> {
  const items: SeedWeighIn[] = []
  for (let index = 0; index < days; index += 1) {
    items.push({ date: addDays(TODAY, index - (days - 1)), weightKg: Math.round((startKg + index * stepKg) * 100) / 100 })
  }
  await seedWeighIns(items)
}

export async function storedWeights(): Promise<WeightEntry[]> {
  return getRepositories().weights.list()
}

export function renderScreen() {
  const user = userEvent.setup()
  render(
    <>
      <ProgressScreen />
      <Toaster />
    </>,
  )
  return { user }
}

/** Renders the screen and waits until it has loaded. */
export async function renderProgress() {
  const result = renderScreen()
  await screen.findByRole('heading', { level: 2, name: 'Log a weigh-in' })
  return result
}

export function region(name: string): HTMLElement {
  return screen.getByRole('region', { name })
}

/** Text of the "Your numbers" stat with this label ("Current" → "71.2kg …"). */
export function statText(label: string): string {
  const labelNode = within(region('Your numbers')).getByText(label, { selector: 'span' })
  return labelNode.parentElement?.textContent ?? ''
}

export function weightInput(): HTMLElement {
  return within(region('Log a weigh-in')).getByRole('textbox', { name: /Weight/ })
}
