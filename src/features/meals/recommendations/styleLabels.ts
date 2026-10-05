import type { Tone } from '@/components/ui'
import type { RecommendationStyle } from '@/domain/adaptive'

/** Display label and badge tone per recommendation style. */
export const STYLE_LABELS: Record<RecommendationStyle, { label: string; tone: Tone }> = {
  balanced: { label: 'Balanced', tone: 'primary' },
  high_protein: { label: 'High protein', tone: 'protein' },
  quick: { label: 'Quick', tone: 'accent' },
  no_cook: { label: 'No-cook', tone: 'info' },
  mediterranean: { label: 'Mediterranean', tone: 'success' },
  budget: { label: 'Budget friendly', tone: 'neutral' },
  light: { label: 'Light', tone: 'fiber' },
}
