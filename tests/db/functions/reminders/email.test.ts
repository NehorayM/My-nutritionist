import { describe, expect, it } from 'vitest'
import { escapeHtml, reminderEmail } from '../../../../supabase/functions/reminders/email.ts'

const APP = 'https://example.org/app/'
const UNSUBSCRIBE = 'https://example.org/app/#/unsubscribe?token=abc'
const FORBIDDEN = /\b(bad|cheat|fail(ed|ure)?|burn|earn|guilt|should have)\b/i

describe('reminder emails', () => {
  it.each([
    ['meal_log', 'lunch', 'Time to log your lunch', '#/meals'],
    ['hydration', null, 'A gentle reminder to drink some water', '#/meals'],
    ['planning', null, 'Plan your meals from what you have', '#/kitchen'],
    ['weigh_in', null, 'Your weigh-in reminder', '#/progress'],
  ] as const)('%s: subject, app link and unsubscribe link', (kind, mealType, subject, route) => {
    const email = reminderEmail({ kind, mealType, appUrl: APP, unsubscribeUrl: UNSUBSCRIBE })
    expect(email.subject).toBe(subject)
    expect(email.text).toContain(`${APP}${route}`)
    expect(email.text).toContain(UNSUBSCRIBE)
    expect(email.html).toContain(`href="${APP}${route}"`)
    expect(email.html).toContain('Turn this reminder off')
    expect(`${email.subject} ${email.text}`).not.toMatch(FORBIDDEN)
  })

  it('test email has no unsubscribe link but a way to manage reminders', () => {
    const email = reminderEmail({ kind: 'test', mealType: null, appUrl: APP, unsubscribeUrl: null })
    expect(email.text).toContain(`${APP}#/profile`)
    expect(email.html).not.toContain('Turn this reminder off')
  })

  it('escapes text placed into HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    const email = reminderEmail({ kind: 'meal_log', mealType: '<script>', appUrl: APP, unsubscribeUrl: `${APP}#/u?t="x"` })
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&quot;x&quot;')
  })
})
