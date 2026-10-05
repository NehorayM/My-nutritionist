import { expect, test } from '@playwright/test'
import { fillPersonalProfile, goToTab, logRun, logWeighIn, trackErrors } from './support/flows.ts'
import { addFoodInGrams, mealCard } from './support/meals.ts'

test.describe('guest mode (no Supabase configuration)', () => {
  test('logs a real day, adapts suggestions, and keeps everything after a refresh', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')

    // 1–2. No account required: the app opens straight into Offline/Local mode.
    await expect(page.getByRole('heading', { level: 1, name: 'Meals' })).toBeVisible()
    await goToTab(page, 'Profile')
    await expect(page.getByRole('region', { name: 'Running in Offline/Local Mode' })).toBeVisible()
    await expect(page.getByText('Connected to Supabase')).toHaveCount(0)

    // 3. Configure the Personal Profile.
    await fillPersonalProfile(page)

    // 4–7. Breakfast: search, change grams, save.
    await goToTab(page, 'Meals')
    await addFoodInGrams(page, 'Breakfast', 'oats', 'Rolled oats (dry)', '60')
    await addFoodInGrams(page, 'Breakfast', 'banana', 'Banana', '120')

    // 8. More meals, including a large pizza lunch.
    await addFoodInGrams(page, 'Lunch', 'pizza', 'Cheese pizza', '476')
    await addFoodInGrams(page, 'Snacks', 'hummus', 'Hummus', '70')

    // 9. Nutrition totals reflect the actual intake (60 g oats ≈ 228 kcal, so breakfast is well above 300).
    await expect(mealCard(page, 'Breakfast').getByText(/kcal · 2 items/)).toBeVisible()
    await expect(page.getByText(/kcal remaining|Above target by/).first()).toBeVisible()

    // 10. Adaptive recommendations for the rest of today.
    await expect(page.getByRole('heading', { name: /Smart options for the rest of today/i })).toBeVisible()

    // Progress and Activity data in the same session.
    await logWeighIn(page, '62.4')
    await logRun(page, '30')

    // 11–12. Refresh: everything is still there (IndexedDB).
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Activity' })).toBeVisible()
    await expect(page.getByText('Run · 30 min', { exact: true })).toBeVisible()
    await goToTab(page, 'Meals')
    await expect(mealCard(page, 'Breakfast').getByRole('button', { name: 'Edit Rolled oats (dry)' })).toBeVisible()
    await expect(mealCard(page, 'Lunch').getByRole('button', { name: 'Edit Cheese pizza' })).toBeVisible()
    await goToTab(page, 'Progress')
    await expect(page.getByText('62.4 kg').first()).toBeVisible()
    await goToTab(page, 'Profile')
    await expect(page.getByRole('region', { name: 'Personal Profile' }).getByLabel(/height/i)).toHaveValue('165')

    expect(errors).toEqual([])
  })
})
