import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps custom font sizes next to text colors', () => {
    expect(cn('text-display', 'text-text')).toBe('text-display text-text')
    expect(cn('text-title text-primary', 'text-2xs')).toBe('text-primary text-2xs')
  })

  it('lets later custom radii, shadows and animations override earlier ones', () => {
    expect(cn('rounded-xl', 'rounded-card')).toBe('rounded-card')
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full')
    expect(cn('shadow-card', 'shadow-raised')).toBe('shadow-raised')
    expect(cn('animate-pulse', 'animate-screen-in')).toBe('animate-screen-in')
  })

  it('still merges token colors and drops falsy inputs', () => {
    expect(cn('bg-surface', false, undefined, 'bg-primary/12')).toBe('bg-primary/12')
    expect(cn('text-text-muted', { 'text-protein-ink': true })).toBe('text-protein-ink')
  })
})
