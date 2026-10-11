/**
 * Edge Function `reminders` — scheduled email reminders (see handler.ts for the routes).
 *
 * Local:   served by the local stack; secrets in supabase/functions/.env (MAILPIT_URL delivers to Mailpit).
 * Hosted:  npx supabase secrets set REMINDERS_CRON_SECRET=… REMINDERS_SIGNING_KEY=… RESEND_API_KEY=… APP_URL=…
 *          npx supabase functions deploy reminders --no-verify-jwt
 */
import { createSupabaseClaimsVerifier, createUserVerifier } from '../_shared/auth.ts'
import { readRemindersEnv } from './config.ts'
import { createRemindersHandler } from './handler.ts'
import { createEmailSender } from './sender.ts'
import { createServiceClient, createSupabaseReminderStore } from './store.ts'
import type { LogFn } from './types.ts'

const env = readRemindersEnv((name) => Deno.env.get(name))

const log: LogFn = (message, details) => {
  console.error(JSON.stringify({ function: 'reminders', message, ...details }))
}

const verifyUser =
  env.supabaseUrl !== null && env.publishableKey !== null
    ? createUserVerifier(createSupabaseClaimsVerifier(env.supabaseUrl, env.publishableKey), (error) =>
        log('auth_verification_error', { error: error instanceof Error ? error.name : 'unknown' }),
      )
    : null

const store = env.supabaseUrl !== null && env.secretKey !== null ? createSupabaseReminderStore(createServiceClient(env.supabaseUrl, env.secretKey)) : null

Deno.serve(
  createRemindersHandler({
    cronSecret: env.cronSecret,
    signingKey: env.signingKey,
    appUrl: env.appUrl,
    functionUrl: env.supabaseUrl === null ? null : `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/reminders`,
    verifyUser,
    store,
    sender: createEmailSender(env, (input, init) => fetch(input, init)),
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
  }),
)
