import { Scale } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Card, EmptyState } from '@/components/ui'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GoalCard } from './components/GoalCard'
import { HistorySection } from './components/HistorySection'
import { ReminderBanner } from './components/ReminderBanner'
import { StatsCard } from './components/StatsCard'
import { WeighInCard } from './components/WeighInCard'
import { WeightChartCard } from './components/WeightChartCard'
import type { ProgressModel } from './hooks/useProgressModel'

/** The loaded Progress screen: reminder, weigh-in, stats, chart, history and goal. */
export function ProgressContent({ model }: { model: ProgressModel }) {
  const { profile, entries, today, stats } = model
  const weightRef = useRef<HTMLInputElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [reminderHidden, setReminderHidden] = useState(false)
  const hasEntries = entries.length > 0
  const loggedToday = entries.some((entry) => entry.date === today)
  const showReminder = profile.reminders.weighIn && hasEntries && !loggedToday && !reminderHidden

  function focusWeighIn() {
    const input = weightRef.current
    if (!input) return
    input.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
    input.focus({ preventScroll: true })
  }

  function hideReminder() {
    setReminderHidden(true)
    weightRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-5 px-5 pb-6 pt-1">
      {showReminder ? <ReminderBanner onLog={focusWeighIn} onHide={hideReminder} /> : null}
      {hasEntries ? null : (
        <Card>
          <EmptyState
            headingLevel="h2"
            icon={<Scale />}
            title="Start your weight trend"
            description="Log your first weigh-in below. Your chart, 7-day trend and stats build up as you go."
            actions={<Button onClick={focusWeighIn}>Log first weigh-in</Button>}
          />
        </Card>
      )}
      <WeighInCard profile={profile} entries={entries} today={today} weightRef={weightRef} />
      {hasEntries ? (
        <>
          <StatsCard
            stats={stats}
            unitSystem={profile.unitSystem}
            today={today}
            firstDate={model.firstDate}
            targetKg={model.activeTargetKg}
            tracksTarget={model.tracksTarget}
          />
          <WeightChartCard profile={profile} entries={entries} today={today} goalInput={model.goalInput} />
          <HistorySection entries={entries} unitSystem={profile.unitSystem} today={today} />
        </>
      ) : null}
      <GoalCard model={model} />
    </div>
  )
}
