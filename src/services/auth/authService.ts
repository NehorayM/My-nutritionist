import { logger } from '@/lib/logger'
import { AUTH_MESSAGES, describeAuthFailure, toAuthFailure } from './authErrors'
export { deferAuthWork } from './defer'
import {
  AUTH_EVENTS,
  type AuthClientLike,
  type AuthEvent,
  type AuthFailure,
  type AuthResult,
  type AuthService,
  type AuthSession,
  type AuthSessionLike,
} from './authTypes'

const KNOWN_EVENTS: ReadonlySet<string> = new Set(AUTH_EVENTS)

function isAuthEvent(event: string): event is AuthEvent {
  return KNOWN_EVENTS.has(event)
}

function toSession(session: AuthSessionLike | null): AuthSession | null {
  return session ? { userId: session.user.id, email: session.user.email ?? null } : null
}

/** Maps and logs a failure (operation name and codes only — never emails, passwords or tokens). */
function fail(operation: string, error: unknown): { ok: false; error: AuthFailure } {
  const mapped = toAuthFailure(error)
  logger.warn('auth', describeAuthFailure(operation, error, mapped))
  return { ok: false, error: mapped }
}

/** Runs `operation`, turning anything it throws into a mapped failure (auth methods never throw). */
async function guard<T extends object>(operation: string, run: () => Promise<AuthResult<T>>): Promise<AuthResult<T>> {
  try {
    return await run()
  } catch (error) {
    return fail(operation, error)
  }
}

/** True when the URL still carries a PKCE `code` — a successful exchange removes it. */
function hasUnusedAuthCode(currentUrl: string): boolean {
  try {
    return new URL(currentUrl).searchParams.has('code')
  } catch {
    return false
  }
}


/**
 * Supabase Auth wrapper with app-shaped sessions and friendly, neutral errors. The client must be the
 * app's shared client (PKCE is configured in `lib/supabase.ts`).
 */
export function createAuthService(client: AuthClientLike): AuthService {
  const { auth } = client

  const getSession = (): Promise<AuthResult<{ session: AuthSession | null }>> =>
    guard('getSession', async () => {
      const { data, error } = await auth.getSession()
      if (error) return fail('getSession', error)
      return { ok: true, session: toSession(data.session) }
    })

  return {
    getSession,

    onAuthStateChange(listener) {
      const { data } = auth.onAuthStateChange((event, session) => {
        if (!isAuthEvent(event)) return
        try {
          listener(event, toSession(session))
        } catch (error) {
          logger.error('auth', `An auth listener failed on ${event}`, error)
        }
      })
      return () => data.subscription.unsubscribe()
    },

    signUp: (email, password, redirectTo) =>
      guard('signUp', async () => {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
        if (error) return fail('signUp', error)
        // With email confirmation on, an existing account gets an obfuscated user without identities.
        if (data.user && data.user.identities?.length === 0) {
          return { ok: false, error: { code: 'user_already_exists', message: AUTH_MESSAGES.user_already_exists } }
        }
        return { ok: true, needsConfirmation: data.session === null, session: toSession(data.session) }
      }),

    signIn: (email, password) =>
      guard('signIn', async () => {
        const { data, error } = await auth.signInWithPassword({ email, password })
        if (error) return fail('signIn', error)
        const session = toSession(data.session)
        return session ? { ok: true, session } : fail('signIn', null)
      }),

    signOut: () =>
      guard('signOut', async () => {
        const { error } = await auth.signOut({ scope: 'local' })
        if (!error) return { ok: true }
        // Supabase removes the local session even when revoking it on the server failed (e.g. offline).
        const after = await getSession()
        return after.ok && after.session === null ? { ok: true } : fail('signOut', error)
      }),

    requestPasswordReset: (email, redirectTo) =>
      guard('requestPasswordReset', async () => {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo })
        return error ? fail('requestPasswordReset', error) : { ok: true }
      }),

    updatePassword: (password) =>
      guard('updatePassword', async () => {
        const { error } = await auth.updateUser({ password })
        return error ? fail('updatePassword', error) : { ok: true }
      }),

    completeRedirect: (currentUrl) =>
      guard('completeRedirect', async () => {
        const { error } = await auth.initialize()
        if (error) return fail('completeRedirect', error)
        // Without this browser's PKCE verifier the client skips the exchange and leaves `code` in place.
        if (hasUnusedAuthCode(currentUrl)) {
          logger.warn('auth', 'auth.completeRedirect failed (link_invalid, code not exchanged)')
          return { ok: false, error: { code: 'link_invalid', message: AUTH_MESSAGES.link_invalid } }
        }
        return getSession()
      }),
  }
}
