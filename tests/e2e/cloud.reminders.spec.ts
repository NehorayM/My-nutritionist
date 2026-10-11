import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { goToTab, trackErrors } from './support/flows.ts'

/**
 * Email reminders end to end on the LOCAL stack: schedule in the app → synced to Supabase → the `reminders`
 * Edge Function dispatch (what pg_cron calls every 5 minutes) → email in Mailpit → delivery shown in the app →
 * the email's unsubscribe link turns the reminder off.
 */
const password = 'e2e-Strong-passw0rd'
const MAILPIT = 'http://127.0.0.1:54324/api/v1'
const FUNCTIONS = 'http://127.0.0.1:54321/functions/v1/reminders'

function cronSecret(): string {
  const secret = /^REMINDERS_CRON_SECRET=(.+)$/m.exec(readFileSync('supabase/functions/.env', 'utf8'))?.[1]?.trim()
  if (!secret) throw new Error('REMINDERS_CRON_SECRET missing in supabase/functions/.env')
  return secret
}

async function mailTo(address: string): Promise<{ ID: string; Subject: string }[]> {
  const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${address}"`)}`)
  return ((await response.json()) as { messages?: { ID: string; Subject: string }[] }).messages ?? []
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('radiogroup', { name: 'Account action' }).getByText('Create account').click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meals' })).toBeVisible()
}

test.describe('email reminders (local Supabase + Mailpit)', () => {
  test('schedule → dispatch → email → shown as sent → unsubscribe link', async ({ page }) => {
    const errors = trackErrors(page)
    const email = `e2e-reminders-${Date.now()}@example.com`
    await signUp(page, email)
    await goToTab(page, 'Profile')

    // Register a water reminder that is due right now (UTC, a minute ago, every day).
    const card = page.getByRole('region', { name: 'Email reminders' })
    await card.getByRole('button', { name: 'Add reminder' }).click()
    const sheet = page.getByRole('dialog', { name: 'New email reminder' })
    await sheet.getByRole('combobox', { name: 'Reminder' }).selectOption('hydration')
    const due = new Date(Date.now() - 60_000).toISOString().slice(11, 16)
    await sheet.getByLabel('Time', { exact: true }).fill(due)
    await sheet.getByRole('combobox', { name: 'Time zone' }).selectOption('UTC')
    await sheet.getByRole('button', { name: 'Add reminder' }).click()
    await expect(card.getByRole('switch', { name: `Drink water · ${due}` })).toBeChecked()
    await expect(page.getByRole('region', { name: 'Connected to Supabase' }).getByText(/Pending synchronization/)).toHaveCount(0, { timeout: 20_000 })

    // The scheduled trigger (pg_cron → Edge Function) runs.
    const dispatch = await fetch(`${FUNCTIONS}/dispatch`, { method: 'POST', headers: { 'x-reminders-secret': cronSecret() } })
    expect(dispatch.status).toBe(200)
    await expect.poll(async () => (await mailTo(email)).map((m) => m.Subject), { timeout: 15_000 }).toEqual(['A gentle reminder to drink some water'])

    // The app learns about the delivery (Realtime) and shows it.
    await expect(card.getByRole('list', { name: 'Recent reminder emails' })).toContainText(/Drink water.*sent/, { timeout: 15_000 })

    // A test email on demand.
    await card.getByRole('button', { name: 'Send test email' }).click()
    await expect(page.getByText('Test email sent').first()).toBeVisible()
    await expect.poll(async () => (await mailTo(email)).length, { timeout: 15_000 }).toBe(2)

    // The email's unsubscribe link (signed token) works without the app session.
    const reminderMail = (await mailTo(email)).find((m) => m.Subject.startsWith('A gentle reminder'))
    const body = (await (await fetch(`${MAILPIT}/message/${reminderMail?.ID ?? ''}`)).json()) as { Text: string }
    const token = /#\/unsubscribe\?token=(\S+)/.exec(body.Text)?.[1] ?? ''
    expect(token).not.toBe('')
    await page.goto(`/#/unsubscribe?token=${token}`)
    await page.getByRole('button', { name: 'Turn off this reminder' }).click()
    await expect(page.getByRole('heading', { name: 'Reminder turned off' })).toBeVisible()

    await page.goto('/#/profile')
    await page.reload()
    await expect(page.getByRole('region', { name: 'Email reminders' }).getByRole('switch', { name: `Drink water · ${due}` })).not.toBeChecked()
    expect(errors).toEqual([])
  })
})
