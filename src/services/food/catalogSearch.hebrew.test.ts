import { describe, expect, it } from 'vitest'
import { createDefaultFoodSearchService } from './defaultService'

/** Everyday Israeli foods users search for in Hebrew, against the bundled catalog (offline, no USDA). */
const service = createDefaultFoodSearchService({ supabase: null, getUserFoods: async () => [] })

describe('Hebrew searches of the bundled catalog', () => {
  it.each([
    ['שניצל', 'Chicken schnitzel (breaded, fried)'],
    ['חביתה', 'Omelet or scrambled eggs (made with oil)'],
    ['ביצה מקושקשת', 'Omelet or scrambled eggs (made with oil)'],
    ['ביצת עין', 'Fried egg (with oil)'],
    ['נאגטס', 'Chicken nuggets'],
    ['חלה', 'Challah'],
    ['מג׳דרה', 'Majadra (rice with lentils)'],
    ['לאפה', 'Laffa / tortilla wrap (flour)'],
    ['פתיתים', 'Couscous, cooked'],
    ['גבינה לבנה', 'White cheese (gvina levana)'],
    ['לבנה', 'Labneh'],
    ['שוקו', 'Chocolate milk (shoko)'],
    ['תפוח אדמה', 'Potato, boiled'],
    ['תירס', 'Sweet corn, canned'],
    ['אפונה', 'Green peas, cooked'],
  ])('%s → %s first', async (hebrew, first) => {
    const result = await service.search(hebrew)
    expect(result.translation?.source).toBe('dictionary')
    expect(result.items[0]?.name).toBe(first)
  })
})
