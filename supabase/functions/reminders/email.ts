import type { ReminderKind } from './types.ts'

/**
 * Reminder emails: short, neutral and supportive (no pressure, no judgement), plain-text and HTML versions,
 * a link into the app and an unsubscribe link in every message.
 */
export interface EmailContent {
  subject: string
  text: string
  html: string
}

export interface ReminderEmailInput {
  kind: ReminderKind | 'test'
  mealType: string | null
  appUrl: string
  /** Link that turns this reminder off (absent for the test email). */
  unsubscribeUrl: string | null
}

const MEALS: Readonly<Record<string, string>> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' }

interface Copy {
  subject: string
  lines: string[]
  action: string
  route: string
}

function copyFor(kind: ReminderEmailInput['kind'], mealType: string | null): Copy {
  const meal = (mealType && MEALS[mealType]) || 'meal'
  switch (kind) {
    case 'meal_log':
      return {
        subject: `Time to log your ${meal}`,
        lines: ['A quick note of what you had keeps today’s picture accurate.', 'It takes less than a minute — and an estimate is fine.'],
        action: `Log ${meal}`,
        route: '#/meals',
      }
    case 'hydration':
      return {
        subject: 'A gentle reminder to drink some water',
        lines: ['A glass of water now is an easy way to look after yourself today.'],
        action: 'Open My-nutritionist',
        route: '#/meals',
      }
    case 'planning':
      return {
        subject: 'Plan your meals from what you have',
        lines: ['Take two minutes to check your kitchen and plan your next meals.', 'Your plan uses only what you have and the time you have.'],
        action: 'Plan meals',
        route: '#/kitchen',
      }
    case 'weigh_in':
      return {
        subject: 'Your weigh-in reminder',
        lines: ['If it’s part of your routine, a quick weigh-in keeps your trend up to date.', 'One reading is just one point — the trend is what matters.'],
        action: 'Add a weigh-in',
        route: '#/progress',
      }
    case 'test':
      return {
        subject: 'Your reminders are set up',
        lines: ['This is a test email from My-nutritionist.', 'Your reminders will arrive at the times you chose.'],
        action: 'Open My-nutritionist',
        route: '#/profile',
      }
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function reminderEmail({ kind, mealType, appUrl, unsubscribeUrl }: ReminderEmailInput): EmailContent {
  const copy = copyFor(kind, mealType)
  const actionUrl = `${appUrl}${copy.route}`
  const manageUrl = `${appUrl}#/profile`
  const footer = unsubscribeUrl
    ? `You get this email because you set up this reminder in My-nutritionist.\nTurn it off: ${unsubscribeUrl}\nManage reminders: ${manageUrl}`
    : `Manage reminders: ${manageUrl}`
  const text = [...copy.lines, '', `${copy.action}: ${actionUrl}`, '', footer].join('\n')
  const paragraphs = copy.lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join('')
  const unsubscribe = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#4b5d55">Turn this reminder off</a> · `
    : ''
  const html =
    `<!doctype html><html lang="en"><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1d2b25">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 20px">` +
    `<p style="margin:0 0 16px;font-weight:bold;color:#2f6b55">My-nutritionist</p>` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(copy.subject)}</h1>` +
    paragraphs +
    `<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2f6b55;color:#ffffff;` +
    `text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${escapeHtml(copy.action)}</a></p>` +
    `<p style="margin:32px 0 0;font-size:12px;line-height:1.5;color:#4b5d55">` +
    `${unsubscribeUrl ? 'You get this email because you set up this reminder in My-nutritionist.<br>' : ''}` +
    `${unsubscribe}<a href="${escapeHtml(manageUrl)}" style="color:#4b5d55">Manage reminders</a></p>` +
    `</div></body></html>`
  return { subject: copy.subject, text, html }
}
