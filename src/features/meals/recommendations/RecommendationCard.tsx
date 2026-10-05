import { Bookmark, Clock, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, IconButton, Select } from '@/components/ui'
import type { MealRecommendation } from '@/domain/adaptive'
import { DEFAULT_MEAL_SLOTS, mealLabel } from '@/domain/meals'
import { NUTRIENTS } from '@/domain/nutrients'
import { formatDuration, formatKcal, formatNutrient } from '@/lib/format'
import type { MealType } from '@/types'
import { formatPortionAmount } from '../model/portion'
import { STYLE_LABELS } from './styleLabels'


interface RecommendationCardProps {
  rec: MealRecommendation
  busy: boolean
  onLog: (mealType: MealType) => void
  onSave: () => void
  onDismiss: () => void
}

export function RecommendationCard({ rec, busy, onLog, onSave, onDismiss }: RecommendationCardProps) {
  const [mealType, setMealType] = useState<MealType>(rec.mealType)
  const style = STYLE_LABELS[rec.style]
  const titleId = `rec-${rec.id.replace(/[^a-z0-9-]/gi, '-')}`
  const extras = rec.highlights.filter((key) => key !== 'calories' && key !== 'protein')

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border/70">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <Badge tone={style.tone}>{style.label}</Badge>
          <h3 id={titleId} className="text-base leading-snug font-semibold text-text">
            {rec.title}
          </h3>
        </div>
        <IconButton label={`Dismiss ${rec.title}`} icon={<X aria-hidden="true" className="size-4" />} variant="ghost" size="sm" onClick={onDismiss} />
      </div>
      <ul className="grid gap-1 text-sm">
        {rec.items.map((item) => (
          <li key={item.food.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate" title={item.food.name}>{item.food.name}</span>
            <span className="shrink-0 text-text-muted tabular-nums">{formatPortionAmount(item)}</span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
        <span className="font-semibold text-text">{formatKcal(rec.totals.calories)}</span>
        <span className="text-protein">{formatNutrient('protein', rec.totals.protein)} protein</span>
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Clock aria-hidden="true" className="size-3.5" />
          {rec.prepMinutes === 0 ? 'No prep' : formatDuration(rec.prepMinutes)}
        </span>
      </p>
      {extras.length > 0 ? (
        <ul aria-label="Key nutrients" className="flex flex-wrap gap-1.5">
          {extras.map((key) => (
            <li key={key}>
              <Badge tone="info">
                {NUTRIENTS[key].shortLabel} {formatNutrient(key, rec.totals[key])}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-text-muted">{rec.explanation}</p>
      <div className="mt-auto grid gap-2 pt-1">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${titleId}-meal`}>Meal for {rec.title}</label>
            <Select<MealType>
              id={`${titleId}-meal`}
              value={mealType}
              onValueChange={setMealType}
              options={DEFAULT_MEAL_SLOTS.map((slot) => ({ value: slot.key, label: slot.label }))}
            />
          </div>
          <IconButton label={`Save ${rec.title} to my meals`} icon={<Bookmark aria-hidden="true" className="size-4" />} variant="secondary" onClick={onSave} />
        </div>
        <Button loading={busy} fullWidth onClick={() => onLog(mealType)}>
          Log to {mealLabel(mealType)}
        </Button>
      </div>
    </article>
  )
}
