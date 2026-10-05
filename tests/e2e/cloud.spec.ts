import { expect, test, type Page } from '@playwright/test'
import { fillPersonalProfile, goToTab, logRun, logWeighIn, trackErrors } from './support/flows'
import { addFoodInGrams, mealCard } from './support/meals'

const password = 'e2e-Strong-passw0rd'

async function waitForSync(page: Page): Promise<void> {
  await goToTab(page, 'Profile')
  const account = page.getByRole('region', { name: 'Connected to Supabase' })
  await expect(account).toBeVisible()
  await expect(account.getByText(/Pending synchronization/)).toHaveCount(0, { timeout: 20_000 })
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meals' })).toBeVisible()
}

test.describe('signed-in mode (local Supabase)', () => {
  test('account data persists in Supabase across refresh and sign-out/sign-in', async ({ page }) => {
    const errors = trackErrors(page)
    const email = `e2e-${Date.now()}@example.com`
    await page.goto('/')

    // 1. Sign up from the welcome screen (local stack auto-confirms email).
    await expect(page.getByRole('heading', { level: 1, name: 'My-nutritionist' })).toBeVisible()
    await page.getByRole('radiogroup', { name: 'Account action' }).getByText('Create account').click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).last().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Meals' })).toBeVisible()

    // 3. Profile, verified connection.
    await fillPersonalProfile(page)
    await expect(page.getByRole('region', { name: 'Connected to Supabase' })).toBeVisible()

    // 4–6. Add, edit and delete foods.
    await goToTab(page, 'Meals')
    await addFoodInGrams(page, 'Breakfast', 'oats', 'Rolled oats (dry)', '60')
    await addFoodInGrams(page, 'Breakfast', 'banana', 'Banana', '120')
    await addFoodInGrams(page, 'Lunch', 'hummus', 'Hummus', '70')
    await mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Rolled oats (dry)' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit entry' })
    await edit.getByRole('combobox', { name: 'Unit' }).selectOption('grams')
    await edit.getByRole('textbox', { name: /Amount/ }).fill('80')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(edit).toBeHidden()
    await expect(mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Rolled oats (dry)' })).toContainText('80 g')
    await mealCard(page, 'Lunch').getByRole('button', { name: 'Remove Hummus' }).click()
    await expect(mealCard(page, 'Lunch').getByText('Nothing logged yet')).toBeVisible()

    // 9–14. Weight, weekly target, workout, weekly progress and Smart Catch-Up.
    await logWeighIn(page, '62.4')
    await expect(page.getByRole('heading', { name: /Weight trend|Your weight/i }).first()).toBeVisible()
    await goToTab(page, 'Activity')
    await page.getByRole('button', { name: 'Edit plan' }).click()
    const plan = page.getByRole('dialog', { name: 'Weekly plan' })
    await plan.getByRole('button', { name: 'More strength sessions' }).click()
    await plan.getByRole('button', { name: 'Save plan' }).click()
    await expect(plan).toBeHidden()
    await logRun(page, '30')
    await expect(page.getByRole('progressbar', { name: 'Cardio' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Smart Catch-Up' })).toBeVisible()

    // 7–8. Refresh: data persists.
    await waitForSync(page)
    await page.reload()
    await goToTab(page, 'Meals')
    await expect(mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Rolled oats (dry)' })).toContainText('80 g')
    await expect(mealCard(page, 'Lunch').getByText('Nothing logged yet')).toBeVisible()

    // 15. Sign out (everything synced → this device's cached copy is removed).
    await waitForSync(page)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'My-nutritionist' })).toBeVisible()

    // 16–17. Sign in again: the data comes back from Supabase.
    await signIn(page, email)
    await expect(mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Rolled oats (dry)' })).toContainText('80 g')
    await expect(mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Banana' })).toBeVisible()
    await goToTab(page, 'Progress')
    await expect(page.getByText('62.4 kg').first()).toBeVisible()
    await goToTab(page, 'Activity')
    await expect(page.getByText('Run · 30 min', { exact: true })).toBeVisible()
    await goToTab(page, 'Profile')
    await expect(page.getByRole('region', { name: 'Personal Profile' }).getByLabel(/height/i)).toHaveValue('165')

    expect(errors).toEqual([])
  })
})
