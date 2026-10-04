import { logger } from '@/lib/logger'
import { createLocalRepositories } from '@/repositories'
import { setRepositories } from '@/services/runtime'
import { useProfileStore } from '@/stores/profileStore'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useWeightStore } from '@/stores/weightStore'
import { getOrCreateGuestId } from './guestId'

/** Loads the data every screen relies on (profile → targets, weigh-ins → latest weight). */
export function loadSharedData(): void {
  void useProfileStore.getState().load()
  void useWeightStore.getState().load()
}

/** Guest mode: local IndexedDB repositories owned by this device's guest id. */
export async function enterGuestMode(): Promise<void> {
  const guestId = await getOrCreateGuestId()
  resetUserStores()
  setRepositories(createLocalRepositories(guestId))
  useSessionStore.setState({ phase: 'ready', mode: 'guest', userId: guestId, email: null })
  logger.info('session', 'Running in Offline/Local mode')
  loadSharedData()
}
