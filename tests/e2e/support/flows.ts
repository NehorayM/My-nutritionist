import { expect, type Page } from '@playwright/test'

/** Collects console errors and uncaught page errors so each test can assert there were none. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

export async function goToTab(page: Page, tab: 'Meals' | 'Progress' | 'Activity' | 'Profile'): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: tab }).click()
  await expect(page.getByRole('heading', { level: 1, name: tab })).toBeVisible()
}

/** Personal Profile: adult, metric. */
export async function fillPersonalProfile(page: Page): Promise<void> {
  await goToTab(page, 'Profile')
  const form = page.getByRole('region', { name: 'Personal Profile' })
  await form.getByLabel(/birth date/i).fill('1990-04-12')
  await form.getByLabel('Sex').selectOption('female')
  await form.getByLabel(/height/i).fill('165')
  await form.getByLabel(/current weight/i).fill('62')
  await form.getByRole('button', { name: 'Save Personal Profile' }).click()
  await expect(page.getByText('Personal Profile saved', { exact: true })).toBeVisible()
}

export async function logWeighIn(page: Page, kg: string): Promise<void> {
  await goToTab(page, 'Progress')
  const card = page.getByRole('region', { name: /weigh-in/i }).first()
  await card.getByLabel('Weight').fill(kg)
  await card.getByRole('button', { name: 'Save weigh-in' }).click()
  await expect(page.getByText('Weigh-in saved', { exact: true })).toBeVisible()
}

export async function logRun(page: Page, minutes: string): Promise<void> {
  await goToTab(page, 'Activity')
  await page.getByRole('button', { name: 'Log workout' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Log workout' })
  await sheet.getByRole('button', { name: 'Run' }).click()
  const duration = sheet.getByRole('textbox', { name: /Duration/ })
  await duration.fill(minutes)
  await sheet.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByText('Workout logged', { exact: true })).toBeVisible()
  await expect(page.getByText(`Run · ${minutes} min`, { exact: true })).toBeVisible()
}
