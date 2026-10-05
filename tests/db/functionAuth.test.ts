import { describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createSupabaseClaimsVerifier, createUserVerifier } from '../../supabase/functions/food-search/auth.ts'

/**
 * The food-search function's caller check (supabase-js auth.getClaims) against the real local Auth server:
 * a real session JWT is accepted, API keys and tampered tokens are not.
 */
const { env, userA } = inject('dbTest')
const verify = createUserVerifier(createSupabaseClaimsVerifier(env.apiUrl, env.publishableKey))

function tamper(jwt: string): string {
  const [header, payload, signature] = jwt.split('.')
  const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as Record<string, unknown>
  const forged = Buffer.from(JSON.stringify({ ...claims, sub: crypto.randomUUID() })).toString('base64url')
  return [header, forged, signature].join('.')
}

describe('food-search caller verification', () => {
  it("accepts a signed-in user's session JWT and resolves their id", async () => {
    await expect(verify(`Bearer ${userA.accessToken}`)).resolves.toBe(userA.id)
  })

  it('rejects the publishable and secret API keys', async () => {
    await expect(verify(`Bearer ${env.publishableKey}`)).resolves.toBeNull()
    await expect(verify(`Bearer ${env.secretKey}`)).resolves.toBeNull()
  })

  it('rejects a token whose claims were altered after signing', async () => {
    await expect(verify(`Bearer ${tamper(userA.accessToken)}`)).resolves.toBeNull()
  })
})
