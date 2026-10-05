import { expect, type Page } from '@playwright/test'

export type MealName = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'

export function mealCard(page: Page, meal: MealName) {
  return page.getByRole('region', { name: meal, exact: true })
}

/** Search the catalog from a meal card, pick a food, set grams and add it. */
export async function addFoodInGrams(page: Page, meal: MealName, query: string, foodName: string, grams: string): Promise<void> {
  await mealCard(page, meal).getByRole('button', { name: `Add food to ${meal}` }).click()
  const sheet = page.getByRole('dialog', { name: 'Add food' })
  await sheet.getByRole('searchbox', { name: 'Search foods' }).fill(query)
  await sheet.getByRole('list', { name: 'Matching foods' }).getByRole('button', { name: foodName }).first().click()
  await sheet.getByRole('combobox', { name: 'Unit' }).selectOption('grams')
  await sheet.getByRole('textbox', { name: /Amount/ }).fill(grams)
  await sheet.getByRole('button', { name: `Add to ${meal}` }).click()
  await expect(page.getByText(`Added to ${meal}`).first()).toBeVisible()
  await expect(sheet).toBeHidden()
  await expect(mealCard(page, meal).getByRole('button', { name: `Edit ${foodName}` })).toBeVisible()
}
