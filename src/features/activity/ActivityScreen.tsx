import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { ScreenHeader } from '@/app/ScreenHeader'
import { Button, ErrorState, LoadingState } from '@/components/ui'
import { useToday } from '@/hooks/useToday'
import { useActivityStore } from '@/stores/activityStore'
import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'
import type { Profile } from '@/types'
import { ActivityNudge } from './components/ActivityNudge'
import { CatchUpCard } from './components/CatchUpCard'
import { ScheduledSection } from './components/ScheduledSection'
import { WeeklyPlanSheet } from './components/WeeklyPlanSheet'
import { WeeklyProgressCard } from './components/WeeklyProgressCard'
import { WorkoutSheet } from './components/WorkoutSheet'
import { WorkoutsSection } from './components/WorkoutsSection'
import { useActivitySheets, type ActivitySheets } from './hooks/useActivitySheets'
import { useEstimateWeightKg, useWeeklyProgress } from './hooks/useWeeklyActivity'

interface ContentProps {
  profile: Profile
  today: string
  sheets: ActivitySheets
}

function ActivityContent({ profile, today, sheets }: ContentProps) {
  const progress = useWeeklyProgress(profile, today)
  const weightKg = useEstimateWeightKg(profile, today)
  const showNudge = profile.reminders.activity && progress.totalRemaining > 0

  return (
    <div className="space-y-6 px-5 pb-6 pt-1">
      {showNudge ? <ActivityNudge progress={progress} onLog={sheets.openLog} /> : null}
      <WeeklyProgressCard progress={progress} profile={profile} onEditPlan={sheets.openPlan} />
      <CatchUpCard key={progress.week.start} profile={profile} progress={progress} today={today} onEditPlan={sheets.openPlan} />
      <ScheduledSection today={today} onComplete={sheets.openComplete} />
      <WorkoutsSection workouts={progress.workouts} today={today} onLog={sheets.openLog} onEdit={sheets.openEdit} />
      <WorkoutSheet
        key={`workout-${sheets.workout.key}`}
        open={sheets.workout.open}
        onOpenChange={sheets.setWorkoutOpen}
        target={sheets.workout.target}
        today={today}
        profile={profile}
        weightKg={weightKg}
      />
      <WeeklyPlanSheet key={`plan-${sheets.plan.key}`} open={sheets.plan.open} onOpenChange={sheets.setPlanOpen} profile={profile} />
    </div>
  )
}

/** Activity tab: weekly progress against the user's own plan, Smart Catch-Up, scheduled sessions and workouts. */
export function ActivityScreen() {
  const today = useToday()
  const profile = useProfileStore((s) => s.profile)
  const profileStatus = useProfileStore((s) => s.status)
  const status = useActivityStore((s) => s.status)
  const error = useActivityStore((s) => s.error)
  const sheets = useActivitySheets()
  const weekStartsOn = profile?.weekStartsOn
  const ready = profile !== null && status === 'ready'
  const idle = status === 'idle'

  // Loads on open and when the week (or week start) changes; an idle store (e.g. reset by a user switch) loads afresh.
  useEffect(() => {
    if (weekStartsOn !== undefined) void useActivityStore.getState().load(today, weekStartsOn, { force: idle })
  }, [today, weekStartsOn, idle])

  // Weigh-ins feed the informational kcal estimate (the profile weight is the fallback).
  useEffect(() => {
    if (useWeightStore.getState().status === 'idle') void useWeightStore.getState().load()
  }, [])

  function retry() {
    if (profile) void useActivityStore.getState().load(today, profile.weekStartsOn, { force: true })
    else void useProfileStore.getState().load()
  }

  let body
  if (profile === null && profileStatus === 'error') {
    body = <ErrorState title="Your weekly plan didn't load" onRetry={retry} />
  } else if (profile !== null && status === 'error') {
    body = <ErrorState title="Your activity didn't load" description={`${error ?? ''} Your data is safe.`.trim()} onRetry={retry} />
  } else if (!ready) {
    body = <LoadingState label="Loading your week…" />
  } else {
    body = <ActivityContent profile={profile} today={today} sheets={sheets} />
  }

  return (
    <>
      <ScreenHeader
        title="Activity"
        subtitle="Your plan and workouts"
        actions={
          ready ? (
            <Button size="sm" leadingIcon={<Plus />} onClick={sheets.openLog}>
              Log workout
            </Button>
          ) : null
        }
      />
      {body}
    </>
  )
}
