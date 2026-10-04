import { CalendarPlus, Shuffle, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui'
import type { CatchUpSuggestion, WeeklyActivityProgress } from '@/domain/activity'
import { notify } from '@/lib/notify'
import { useActivityStore } from '@/stores/activityStore'
import { useUiStore } from '@/stores/uiStore'
import type { Profile } from '@/types'
import { useCatchUpPlan } from '../hooks/useWeeklyActivity'
import { CATCH_UP_BADGES, NO_PLAN_MESSAGE, plural } from '../model/labels'
import { SuggestionRow } from './SuggestionRow'

interface CatchUpCardProps {
  profile: Profile
  progress: WeeklyActivityProgress
  today: string
  onEditPlan: () => void
}

/** Smart Catch-Up: deterministic, recovery-aware suggestions for the sessions still open this week. */
export function CatchUpCard({ profile, progress, today, onEditPlan }: CatchUpCardProps) {
  const titleId = useId()
  const [variant, setVariant] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const { plan, hasHidden } = useCatchUpPlan(profile, progress, variant)
  const weekStart = progress.week.start
  const badge = CATCH_UP_BADGES[plan.status]

  function dismiss(suggestion: CatchUpSuggestion) {
    useUiStore.getState().dismissCatchUp(weekStart, suggestion.id)
    setAnnouncement('Suggestion dismissed.')
    notify.info('Suggestion dismissed', {
      id: `catch-up-dismiss-${suggestion.id}`,
      undo: () => useUiStore.getState().restoreCatchUp(weekStart, suggestion.id),
    })
  }

  function showAnother() {
    setVariant((value) => value + 1)
    setAnnouncement('Showing another option.')
  }

  function restoreDismissed() {
    const ui = useUiStore.getState()
    for (const id of ui.dismissedCatchUpsFor(weekStart)) ui.restoreCatchUp(weekStart, id)
    setAnnouncement('Dismissed suggestions are back.')
  }

  async function accept() {
    setScheduling(true)
    const count = plan.suggestions.length
    const result = await useActivityStore.getState().scheduleSessions(plan.suggestions)
    setScheduling(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    setVariant(0)
    setAnnouncement(`${plural(count, 'session')} scheduled.`)
    notify.success(`${plural(count, 'session')} scheduled`, { description: 'Find them under Scheduled sessions.' })
  }

  return (
    <Card as="section" aria-labelledby={titleId}>
      <CardHeader action={<Badge tone={badge.tone}>{badge.label}</Badge>}>
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-accent-ink" />
          <CardTitle as="h2" id={titleId} className="text-lg">
            Smart Catch-Up
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[0.9375rem] text-text">{plan.status === 'no_plan' ? NO_PLAN_MESSAGE : plan.message}</p>
        {plan.suggestions.length > 0 ? (
          <ul aria-label="Suggested sessions" className="divide-y divide-border/70">
            {plan.suggestions.map((suggestion) => (
              <SuggestionRow key={suggestion.id} suggestion={suggestion} today={today} onDismiss={dismiss} />
            ))}
          </ul>
        ) : null}
        <output className="sr-only">{announcement}</output>
      </CardContent>
      {plan.status === 'no_plan' ? (
        <CardFooter>
          <Button variant="secondary" size="sm" leadingIcon={<SlidersHorizontal />} onClick={onEditPlan}>
            Set weekly plan
          </Button>
        </CardFooter>
      ) : null}
      {plan.suggestions.length > 0 || hasHidden ? (
        <CardFooter>
          {plan.suggestions.length > 0 ? (
            <Button size="sm" leadingIcon={<CalendarPlus />} loading={scheduling} onClick={() => void accept()}>
              Accept &amp; schedule
            </Button>
          ) : null}
          {plan.alternatives.length > 0 ? (
            <Button variant="secondary" size="sm" leadingIcon={<Shuffle />} onClick={showAnother}>
              View another option
            </Button>
          ) : null}
          {hasHidden ? (
            <Button variant="ghost" size="sm" onClick={restoreDismissed}>
              Show dismissed
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
