import { expect, type Page } from '@playwright/test'

/** Adds a pantry item through the Kitchen tab: search (any language), pick, amount in grams, how it's eaten. */
export async function addKitchenItem(
  page: Page,
  query: string,
  foodName: string,
  grams: string,
  prep: 'Ready to eat' | 'Warm up' | 'Cook from raw',
): Promise<void> {
  await page.getByRole('button', { name: 'Add item' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add to your kitchen' })
  await sheet.getByRole('searchbox', { name: 'Find a food' }).fill(query)
  await sheet.getByRole('list', { name: 'Foods to add' }).getByRole('button', { name: foodName }).first().click()
  await sheet.getByRole('combobox', { name: 'Unit' }).selectOption('grams')
  await sheet.getByRole('textbox', { name: 'Amount' }).fill(grams)
  await sheet.getByText(prep, { exact: true }).click()
  await sheet.getByRole('button', { name: 'Add to kitchen' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('list', { name: 'Kitchen items' }).getByText(foodName, { exact: true })).toBeVisible()
}
