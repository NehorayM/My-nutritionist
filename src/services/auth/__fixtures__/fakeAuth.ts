import { vi } from 'vitest'
import type { AuthApi, AuthSessionLike } from '../authTypes'

type Callback = (event: string, session: AuthSessionLike | null) => void

export const EMAIL = 'noa.levi@mail.test'
export const PASSWORD = 'correct horse battery staple'

/** A provider session; pass `email: null` for an account without an email address. */
export function authSession(id = 'user-1', email: string | null = EMAIL): AuthSessionLike {
  return { user: { id, email: email ?? undefined, identities: [{}] } }
}

/** In-memory stand-in for `supabase.auth`: every method is a typed `vi.fn`; `emit` plays an auth event. */
export function createFakeAuth() {
  const callbacks = new Set<Callback>()
  const unsubscribe = vi.fn<() => void>()
  const auth = {
    initialize: vi.fn<AuthApi['initialize']>().mockResolvedValue({ error: null }),
    getSession: vi.fn<AuthApi['getSession']>().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn<AuthApi['onAuthStateChange']>((callback) => {
      callbacks.add(callback)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribe()
              callbacks.delete(callback)
            },
          },
        },
      }
    }),
    signUp: vi.fn<AuthApi['signUp']>().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signInWithPassword: vi.fn<AuthApi['signInWithPassword']>().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: vi.fn<AuthApi['signOut']>().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn<AuthApi['resetPasswordForEmail']>().mockResolvedValue({ error: null }),
    updateUser: vi.fn<AuthApi['updateUser']>().mockResolvedValue({ error: null }),
  } satisfies AuthApi
  return {
    client: { auth },
    auth,
    unsubscribe,
    emit(event: string, session: AuthSessionLike | null): void {
      for (const callback of [...callbacks]) callback(event, session)
    },
  }
}
