/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { trackErrors } from './support/flows.ts'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, nav: 'bottom' },
  { name: 'tablet', width: 820, height: 1180, nav: 'side' },
  { name: 'desktop', width: 1440, height: 900, nav: 'side' },
] as const

const TABS = ['Meals', 'Kitchen', 'Progress', 'Activity', 'Profile'] as const

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

for (const viewport of VIEWPORTS) {
  test.describe(`responsive layout: ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('every tab renders with one primary navigation and no sideways scrolling', async ({ page }) => {
      const errors = trackErrors(page)
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'Meals' })).toBeVisible()
      const nav = page.getByRole('navigation', { name: 'Primary' })
      await expect(nav).toHaveCount(1)
      const box = await nav.boundingBox()
      if (viewport.nav === 'bottom') expect(box?.y ?? 0).toBeGreaterThan(viewport.height / 2)
      else expect(box?.x ?? 999).toBeLessThan(viewport.width / 4)

      for (const tab of TABS) {
        await nav.getByRole('link', { name: tab }).click()
        await expect(page.getByRole('heading', { level: 1, name: tab })).toBeVisible()
        await page.waitForLoadState('networkidle')
        expect(await horizontalOverflow(page), `${tab} fits the ${viewport.name} width`).toBeLessThanOrEqual(0)
      }
      expect(errors).toEqual([])
    })
  })
}

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('places today’s summary next to the meal cards', async ({ page }) => {
    await page.goto('/')
    const breakfast = await page.getByRole('region', { name: 'Breakfast', exact: true }).boundingBox()
    const calories = await page.getByRole('progressbar', { name: 'Calories' }).boundingBox()
    expect(breakfast && calories && calories.x > breakfast.x + breakfast.width).toBe(true)
  })
})
