import { RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, SectionHeader } from '@/components/ui'
import type { MealRecommendation } from '@/domain/adaptive'
import type { DailyTargets } from '@/domain/nutrition'
import { notify } from '@/lib/notify'
import type { MealEntry, MealType } from '@/types'
import { logRecommendation, saveRecommendation } from './recommendationActions'
import { RecommendationCard } from './RecommendationCard'
import { useAdaptivePlan } from './useAdaptivePlan'

interface RecommendationsSectionProps {
  date: string
  entries: MealEntry[]
  targets: DailyTargets
}

/** "Smart options for the rest of today" — the Adaptive Nutrition Engine's suggestions for the next meal. */
export function RecommendationsSection({ date, entries, targets }: RecommendationsSectionProps) {
  const { plan, showAnother, dismiss, restore } = useAdaptivePlan(date, entries, targets)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Suggestions are about the rest of today; past days only show what was logged.
  if (plan.status === 'past_day') return null

  async function log(rec: MealRecommendation, mealType: MealType): Promise<void> {
    setBusyId(rec.id)
    await logRecommendation(rec, mealType, date)
    setBusyId(null)
  }

  function dismissWithUndo(rec: MealRecommendation): void {
    dismiss(rec.id)
    notify.info('Suggestion hidden for today', { undo: () => restore(rec.id) })
  }

  return (
    <section aria-labelledby="smart-options-title" className="grid gap-3">
      <SectionHeader
        id="smart-options-title"
        title="Smart options for the rest of today"
        description={plan.message}
        action={
          plan.recommendations.length > 0 ? (
            <Button size="sm" variant="ghost" leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />} onClick={showAnother}>
              Other options
            </Button>
          ) : null
        }
      />
      {plan.status === 'ok' && plan.recommendations.length > 0 ? (
        <ul
          aria-label="Suggested meals"
          className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin]"
        >
          {plan.recommendations.map((rec) => (
            <li key={rec.id} className="w-[min(18.5rem,82%)] shrink-0 snap-start">
              <RecommendationCard
                rec={rec}
                busy={busyId === rec.id}
                onLog={(mealType) => void log(rec, mealType)}
                onSave={() => void saveRecommendation(rec)}
                onDismiss={() => dismissWithUndo(rec)}
              />
            </li>
          ))}
        </ul>
      ) : plan.status === 'no_candidates' ? (
        <EmptyState
          compact
          icon={<Sparkles aria-hidden="true" />}
          title="No suggestions match your preferences"
          description="Your allergies, eating pattern and prep-time settings leave no foods to suggest right now."
          actions={
            <Button size="sm" variant="secondary" onClick={() => window.location.assign('#/profile')}>
              Review food preferences
            </Button>
          }
        />
      ) : plan.status === 'ok' ? (
        <EmptyState
          compact
          icon={<Sparkles aria-hidden="true" />}
          title="You've hidden today's suggestions"
          description="Try other options, or log anything you like — suggestions update as you go."
          actions={
            <Button size="sm" variant="secondary" onClick={showAnother}>
              Show other options
            </Button>
          }
        />
      ) : null}
    </section>
  )
}
