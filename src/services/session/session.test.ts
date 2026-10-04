import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { isUuid } from '@/lib/id'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useProfileStore } from '@/stores/profileStore'
import { useSessionStore } from '@/stores/sessionStore'
import { getOrCreateGuestId, peekGuestId } from './guestId'
import { enterGuestMode } from './sessionController'

beforeEach(async () => {
  await deleteDatabase()
  useSessionStore.setState({ phase: 'booting', mode: null, userId: null, email: null })
})

afterEach(() => setRepositories(null))

describe('guest identity', () => {
  it('creates one stable guest id per device and survives a cleared localStorage', async () => {
    expect(await peekGuestId()).toBeNull()
    const id = await getOrCreateGuestId()
    expect(isUuid(id)).toBe(true)
    expect(await getOrCreateGuestId()).toBe(id)
    localStorage.clear()
    expect(await peekGuestId()).toBe(id)
    expect(await getOrCreateGuestId()).toBe(id)
  })
})

describe('enterGuestMode', () => {
  it('binds local repositories to the guest and loads shared data', async () => {
    await enterGuestMode()
    const session = useSessionStore.getState()
    expect(session).toMatchObject({ phase: 'ready', mode: 'guest', email: null })
    expect(getRepositories().userId).toBe(session.userId)
    await expect.poll(() => useProfileStore.getState().status).toBe('ready')
    expect(useProfileStore.getState().profile?.userId).toBe(session.userId)
  })
})
