/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { goToTab, trackErrors } from './support/flows.ts'
import { addKitchenItem } from './support/kitchen.ts'
import { mealCard } from './support/meals.ts'

test.describe('guest mode: Hebrew search and planning from the kitchen', () => {
  test('a Hebrew query is searched in English and the food can be logged', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await mealCard(page, 'Lunch').getByRole('button', { name: 'Add food to Lunch' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    const search = sheet.getByRole('searchbox', { name: 'Search foods' })
    await search.fill('חזה עוף צלוי')
    // Typed right-to-left (dir="auto" resolves to rtl for Hebrew).
    expect(await search.evaluate((input) => getComputedStyle(input).direction)).toBe('rtl')
    await expect(sheet.getByTestId('translation-note')).toContainText('Searching in English for “roasted chicken breast”')
    await sheet.getByRole('list', { name: 'Matching foods' }).getByRole('button', { name: /^Chicken breast, roasted/ }).first().click()
    await sheet.getByRole('button', { name: 'Add to Lunch' }).click()
    await expect(mealCard(page, 'Lunch').getByRole('button', { name: 'Edit Chicken breast, roasted (skinless)' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('inventory and constraints in → meals made only from them out → log one', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/kitchen')
    await expect(page.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your kitchen is empty' })).toBeVisible()

    await addKitchenItem(page, 'ביצים', 'Egg, hard-boiled', '300', 'Ready to eat')
    await addKitchenItem(page, 'לחם מלא', 'Whole-wheat bread', '300', 'Ready to eat')
    await addKitchenItem(page, 'יוגורט יווני', 'Greek yogurt, plain, low-fat', '500', 'Ready to eat')
    await addKitchenItem(page, 'banana', 'Banana', '360', 'Ready to eat')
    await addKitchenItem(page, 'אורז לבן', 'White rice, cooked', '400', 'Warm up')
    await addKitchenItem(page, 'chicken breast', 'Chicken breast, roasted (skinless)', '500', 'Cook from raw')
    await addKitchenItem(page, 'hummus', 'Hummus', '250', 'Ready to eat')
    await addKitchenItem(page, 'almonds', 'Almonds', '150', 'Ready to eat')

    // Lunch at work: only a microwave, no cooking, 10 minutes.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const settings = page.getByRole('dialog', { name: 'Kitchen & time' })
    await settings.getByText('Per meal', { exact: true }).click()
    const lunch = settings.getByRole('group', { name: 'Lunch' })
    await lunch.getByRole('button', { name: 'Stove' }).click()
    await lunch.getByRole('button', { name: 'Oven' }).click()
    await lunch.getByRole('switch', { name: /I can cook/ }).click()
    await lunch.getByRole('textbox', { name: 'Time' }).fill('10')
    await settings.getByRole('button', { name: 'Save' }).click()
    await expect(settings).toBeHidden()

    const lunchPlan = page.getByRole('article', { name: 'Lunch plan' })
    await expect(lunchPlan.getByRole('list', { name: 'Lunch items' })).toBeVisible()
    await expect(lunchPlan.getByText(/Chicken breast/)).toHaveCount(0)
    await expect(page.getByTestId('day-total')).toContainText('kcal planned')

    const breakfast = page.getByRole('article', { name: 'Breakfast plan' })
    const planned = await breakfast.getByRole('list', { name: 'Breakfast items' }).getByRole('listitem').count()
    await breakfast.getByRole('button', { name: 'Log to breakfast' }).click()
    await expect(page.getByText('Logged to Breakfast').first()).toBeVisible()

    await goToTab(page, 'Meals')
    await expect(mealCard(page, 'Breakfast').getByText(new RegExp(`kcal · ${planned} item`))).toBeVisible()
    expect(errors).toEqual([])
  })
})
