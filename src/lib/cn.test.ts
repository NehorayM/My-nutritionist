import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps custom font-size tokens next to color utilities', () => {
    expect(cn('text-display', 'text-text')).toBe('text-display text-text')
  })

  it('lets later utilities override earlier ones, including custom radii', () => {
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full')
    expect(cn('px-2', false, 'px-4')).toBe('px-4')
  })
})
