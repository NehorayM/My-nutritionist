import { useEffect } from 'react'
import { ScreenHeader } from '@/app/ScreenHeader'
import { ErrorState, LoadingState, Skeleton } from '@/components/ui'
import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'
import { ProgressContent } from './ProgressContent'
import { useProgressModel } from './hooks/useProgressModel'

/** Progress tab: weigh-ins, weight trend chart, stats, history and goal settings. */
export function ProgressScreen() {
  const profileStatus = useProfileStore((s) => s.status)
  const profileError = useProfileStore((s) => s.error)
  const weightStatus = useWeightStore((s) => s.status)
  const weightError = useWeightStore((s) => s.error)
  const model = useProgressModel()

  // The session normally loads shared data; load here too if this screen is first to need it.
  useEffect(() => {
    if (useProfileStore.getState().status === 'idle') void useProfileStore.getState().load()
    if (useWeightStore.getState().status === 'idle') void useWeightStore.getState().load()
  }, [])

  function retry() {
    if (useProfileStore.getState().status === 'error') void useProfileStore.getState().load()
    if (useWeightStore.getState().status === 'error') void useWeightStore.getState().load()
  }

  const failed = profileStatus === 'error' || weightStatus === 'error'
  const ready = profileStatus === 'ready' && weightStatus === 'ready' && model !== null

  return (
    <>
      <ScreenHeader title="Progress" subtitle="Weigh-ins and your weight trend" />
      {failed ? (
        <ErrorState
          title="Couldn't load your progress"
          description={`${weightError ?? profileError ?? ''} Your data is safe.`.trim()}
          onRetry={retry}
        />
      ) : ready ? (
        <ProgressContent model={model} />
      ) : (
        <div className="space-y-4 px-5 pt-1" aria-busy="true">
          <LoadingState label="Loading your progress…" className="py-6" />
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      )}
    </>
  )
}
