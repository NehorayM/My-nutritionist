/**
 * Chart colors as design tokens (CSS variables), so both themes follow automatically.
 * Weigh-ins indigo dots, trend evergreen line, target pace apricot dashed line — validated as a
 * three-slot palette against both surfaces; shape (dot / solid / dashed) and the legend carry identity too.
 */
export const CHART_COLORS = {
  weighIn: 'var(--color-protein)',
  trend: 'var(--color-primary)',
  target: 'var(--color-energy)',
  grid: 'var(--color-border)',
  axis: 'var(--color-text-muted)',
  surface: 'var(--color-surface)',
} as const

export const TARGET_DASH = '6 5'
export const CHART_HEIGHT = 220
