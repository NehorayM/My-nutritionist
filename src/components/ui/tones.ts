/**
 * Color tones shared by badges, progress indicators and stats.
 * Class strings are written out in full so Tailwind can detect them.
 */
export const TONES = [
  'neutral',
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'energy',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'micro',
] as const

export type Tone = (typeof TONES)[number]

/** Solid fill (bars, dots). */
export const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-text-muted',
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  energy: 'bg-energy',
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
  fiber: 'bg-fiber',
  micro: 'bg-micro',
}

/** SVG stroke (rings). */
export const TONE_STROKE: Record<Tone, string> = {
  neutral: 'stroke-text-muted',
  primary: 'stroke-primary',
  accent: 'stroke-accent',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  info: 'stroke-info',
  energy: 'stroke-energy',
  protein: 'stroke-protein',
  carbs: 'stroke-carbs',
  fat: 'stroke-fat',
  fiber: 'stroke-fiber',
  micro: 'stroke-micro',
}

/** Text-safe foreground for small text in the tone. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-text-muted',
  primary: 'text-primary',
  accent: 'text-accent-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  energy: 'text-energy-ink',
  protein: 'text-protein-ink',
  carbs: 'text-carbs-ink',
  fat: 'text-fat-ink',
  fiber: 'text-fiber-ink',
  micro: 'text-micro-ink',
}

/** Tinted background + readable text (badges, chips). */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-muted',
  primary: 'bg-primary/12 text-primary',
  accent: 'bg-accent/22 text-accent-ink',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  energy: 'bg-energy/16 text-energy-ink',
  protein: 'bg-protein/14 text-protein-ink',
  carbs: 'bg-carbs/18 text-carbs-ink',
  fat: 'bg-fat/14 text-fat-ink',
  fiber: 'bg-fiber/14 text-fiber-ink',
  micro: 'bg-micro/14 text-micro-ink',
}
