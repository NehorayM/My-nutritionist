import { describe, expect, it } from 'vitest'
import { containsHebrew, normalizeHebrew, singularForms, withoutPrefixes, wordVariants } from './hebrew'
import { translateWithDictionary } from './translate'

describe('Hebrew helpers', () => {
  it('detects Hebrew and normalizes niqqud, geresh and punctuation', () => {
    expect(containsHebrew('oats')).toBe(false)
    expect(containsHebrew('יוגורט 3%')).toBe(true)
    expect(normalizeHebrew('  קוֹטֶג׳ , ‏חָלָב ')).toBe("קוטג' חלב")
    expect(normalizeHebrew('צ״יפס–חם')).toBe('צ"יפס חם')
  })

  it('suggests prefix-less and singular forms (the dictionary picks the real word)', () => {
    expect(withoutPrefixes('והעגבניות')).toContain('עגבניות')
    expect(singularForms('תפוחים')).toContain('תפוח')
    expect(singularForms('עגבניות')).toContain('עגבניה')
    expect(singularForms('ביצת')).toContain('ביצה')
    expect(wordVariants('לחם')[0]).toBe('לחם')
    expect(withoutPrefixes('בא')).toEqual([])
  })
})

describe('dictionary translation of food searches', () => {
  it.each([
    ['חזה עוף', 'chicken breast'],
    ['חזה עוף צלוי', 'roasted chicken breast'],
    ['עגבניות', 'tomatoes'],
    ['והעגבניות', 'tomatoes'],
    ['אורז מלא', 'brown rice'],
    ['לחם מלא', 'whole wheat bread'],
    ['חלב מלא', 'whole milk'],
    ['כוס חלב', 'milk'],
    ['שניצל עם צ׳יפס', 'schnitzel french fries'],
    ['פיתה עם חומוס', 'pita hummus'],
    ['סלט ישראלי', 'israeli salad'],
    ['תפוחי אדמה אפויים', 'baked potatoes'],
    ['קוטג׳', 'cottage cheese'],
    ['שקשוקה', 'shakshuka'],
    ['בשר טחון', 'ground beef'],
    ['דג סלמון אפוי', 'baked salmon'],
    ['עוגת גבינה', 'cheesecake'],
    ['פירות יער', 'mixed berries'],
    ['תפוחים ירוקים', 'green apples'],
    ['שוקולד מריר 70%', 'dark chocolate 70%'],
    ['בננות', 'bananas'],
    ['אגוזי מלך', 'walnuts'],
    ['קפה הפוך', 'cappuccino'],
    ['גבינה צהובה דלת שומן', 'low fat yellow cheese'],
  ])('%s → %s', (hebrew, english) => {
    expect(translateWithDictionary(hebrew)).toEqual({ original: hebrew, query: english, source: 'dictionary', unknown: [] })
  })

  it('keeps numbers and Latin words (brands, percentages)', () => {
    expect(translateWithDictionary('יוגורט Danone 3%')?.query).toBe('yogurt danone 3%')
  })

  it('reports words it does not know (for machine translation) and keeps the rest', () => {
    expect(translateWithDictionary('אורז עם פסיפלורה')).toEqual({
      original: 'אורז עם פסיפלורה',
      query: 'rice',
      source: 'partial',
      unknown: ['פסיפלורה'],
    })
  })

  it('returns null for text without Hebrew', () => {
    expect(translateWithDictionary('chicken breast')).toBeNull()
    expect(translateWithDictionary('')).toBeNull()
  })

  it('translates every phrase of a real-world list', () => {
    const everyday = ['חלב סויה', 'גבינה לבנה', 'לבנה', 'במבה', 'ביסלי', 'פתיתים', 'בורקס גבינה', 'סביח', 'ג׳חנון', 'מלאווח', 'טחינה', 'סילאן', 'עמבה', 'חלבה', 'במיה', 'קישואים', 'חצילים', 'אבטיח', 'רימונים', 'תמרים']
    const missing = everyday.filter((phrase) => translateWithDictionary(phrase)?.source !== 'dictionary')
    expect(missing).toEqual([])
  })
})
