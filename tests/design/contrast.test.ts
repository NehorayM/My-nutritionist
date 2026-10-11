import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read from disk: the test runner replaces imported CSS with an empty module.
const tokens = readFileSync('src/app/styles/tokens.css', 'utf8')

/**
 * WCAG 2.2 contrast of the design tokens, computed from their OKLCH values (both themes). Guards the
 * redesign: text must stay readable on every surface it is used on.
 */
type Theme = 'light' | 'dark'

function block(theme: Theme): string {
  if (theme === 'light') return tokens.slice(tokens.indexOf('@theme'), tokens.indexOf('@layer base'))
  const start = tokens.indexOf(':root[data-theme="dark"]')
  return tokens.slice(start, tokens.indexOf('}', start))
}

function colors(theme: Theme): Map<string, [number, number, number]> {
  const found = new Map<string, [number, number, number]>()
  const light = theme === 'dark' ? colors('light') : null
  for (const [name, value] of light ?? []) found.set(name, value)
  for (const match of block(theme).matchAll(/--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) {
    found.set(match[1] ?? '', [Number(match[2]), Number(match[3]), Number(match[4])])
  }
  return found
}

/** Relative luminance of an OKLCH color (via linear sRGB, clamped to the gamut). */
function luminance([l, c, h]: [number, number, number]): number {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const r = clamp(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc)
  const g = clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc)
  const bl = clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrast(theme: Theme, foreground: string, background: string): number {
  const palette = colors(theme)
  const fg = palette.get(foreground)
  const bg = palette.get(background)
  if (!fg || !bg) throw new Error(`Unknown token ${fg ? background : foreground}`)
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS: [string, string, number][] = [
  ['text', 'bg', 12],
  ['text', 'surface', 12],
  ['text', 'surface-2', 11],
  ['text-muted', 'bg', 5.5],
  ['text-muted', 'surface', 5.5],
  ['text-muted', 'surface-2', 4.5],
  ['primary-foreground', 'primary', 5.5],
  ['primary', 'surface', 4.5],
  ['danger-foreground', 'danger', 4.5],
  ['danger', 'surface', 4.5],
  ['success', 'surface', 4.5],
  ['warning', 'surface', 4.5],
  ['info', 'surface', 4.5],
  ['accent-foreground', 'accent', 4.5],
]

describe.each<Theme>(['light', 'dark'])('%s theme contrast (WCAG 2.2)', (theme) => {
  it.each(PAIRS)('%s on %s ≥ %s:1', (foreground, background, minimum) => {
    expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(minimum)
  })

  it('focus ring is visible against the page (non-text contrast ≥ 3:1)', () => {
    expect(contrast(theme, 'ring', 'bg')).toBeGreaterThanOrEqual(3)
  })
})
