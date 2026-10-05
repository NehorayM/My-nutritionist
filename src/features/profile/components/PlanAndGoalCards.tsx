import { Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { WeeklyPlanSheet } from '@/features/activity/components/WeeklyPlanSheet'
import { GoalCard } from '@/features/progress/components/GoalCard'
import { useProgressModel } from '@/features/progress/hooks/useProgressModel'
import { formatDuration } from '@/lib/format'
import type { Profile } from '@/types'

/** Weight goal settings — the same card as on the Progress tab. */
export function ProfileGoalCard() {
  const model = useProgressModel()
  return model ? <GoalCard model={model} /> : null
}

function sessions(count: number, kind: string): string {
  return `${count} ${kind} session${count === 1 ? '' : 's'}`
}

/** Summary of the weekly activity plan with the shared editor sheet. */
export function ActivityPlanCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const none = profile.strengthSessionsPerWeek === 0 && profile.cardioSessionsPerWeek === 0
  return (
    <Card as="section" aria-labelledby="activity-plan-title">
      <CardHeader>
        <CardTitle as="h2" id="activity-plan-title">
          <Dumbbell aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          Weekly activity plan
        </CardTitle>
        <CardDescription>Your own targets — Smart Catch-Up works from these.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-text">
          {none
            ? 'No weekly sessions planned yet.'
            : `${sessions(profile.strengthSessionsPerWeek, 'strength')} and ${sessions(profile.cardioSessionsPerWeek, 'cardio')} a week, about ${formatDuration(profile.preferredWorkoutMinutes)} each.`}
        </p>
        <Button variant="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
          Edit weekly plan
        </Button>
        <WeeklyPlanSheet open={open} onOpenChange={setOpen} profile={profile} />
      </CardContent>
    </Card>
  )
}
