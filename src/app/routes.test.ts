import { describe, expect, it } from 'vitest'
import { parseHash, unsubscribeTokenFromHash } from './routes'

describe('email unsubscribe links', () => {
  it('reads the token and is never rewritten as a tab route', () => {
    expect(unsubscribeTokenFromHash('#/unsubscribe?token=a.b.c')).toBe('a.b.c')
    expect(unsubscribeTokenFromHash('#/unsubscribe')).toBeNull()
    expect(unsubscribeTokenFromHash('#/meals')).toBeNull()
    expect(parseHash('#/unsubscribe?token=a.b.c')).toEqual({ kind: 'other' })
  })
})
