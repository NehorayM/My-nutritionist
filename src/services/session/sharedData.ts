import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'

/** Loads the data every screen relies on (profile → targets, weigh-ins → latest weight). */
export function loadSharedData(): void {
  void useProfileStore.getState().load()
  void useWeightStore.getState().load()
}
