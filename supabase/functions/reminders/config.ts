/**
 * Environment of the `reminders` Edge Function. Secrets (set with `supabase secrets set …`, or in
 * supabase/functions/.env locally) are read through a getter and never logged:
 * - REMINDERS_CRON_SECRET  shared with the pg_cron job (Vault secret `reminders_cron_secret`)
 * - REMINDERS_SIGNING_KEY  signs unsubscribe links
 * - RESEND_API_KEY         email provider (production); MAILPIT_URL instead for local development
 * - REMINDERS_FROM         sender, e.g. "My-nutritionist <reminders@your-domain>"
 * - APP_URL                the app's address used in email links
 */
import { nonEmpty, pickPublishableKey, pickSecretKey, type EnvGetter } from '../_shared/env.ts'

export interface RemindersEnv {
  supabaseUrl: string | null
  publishableKey: string | null
  secretKey: string | null
  cronSecret: string | null
  signingKey: string | null
  resendApiKey: string | null
  mailpitUrl: string | null
  from: string | null
  appUrl: string
}

export const DEFAULT_APP_URL = 'https://nehoraym.github.io/My-nutritionist/'

/** App address with a trailing slash (links append `#/meals` etc.). */
export function normalizeAppUrl(value: string | null): string {
  const url = value ?? DEFAULT_APP_URL
  return url.endsWith('/') ? url : `${url}/`
}

export function readRemindersEnv(get: EnvGetter): RemindersEnv {
  return {
    supabaseUrl: nonEmpty(get('SUPABASE_URL')),
    publishableKey: pickPublishableKey(get),
    secretKey: pickSecretKey(get),
    cronSecret: nonEmpty(get('REMINDERS_CRON_SECRET')),
    signingKey: nonEmpty(get('REMINDERS_SIGNING_KEY')),
    resendApiKey: nonEmpty(get('RESEND_API_KEY')),
    mailpitUrl: nonEmpty(get('MAILPIT_URL')),
    from: nonEmpty(get('REMINDERS_FROM')),
    appUrl: normalizeAppUrl(nonEmpty(get('APP_URL'))),
  }
}
