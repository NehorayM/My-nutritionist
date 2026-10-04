import { describe, expect, it, vi } from 'vitest'
import type { FoodItem } from '@/types'
import { TEST_CATALOG, testFood } from '../__fixtures__/foods'
import { createLocalCatalogProvider } from './localCatalogProvider'

function provider(userFoods: readonly FoodItem[] = []) {
  return createLocalCatalogProvider({ catalog: TEST_CATALOG, getUserFoods: async () => userFoods })
}

async function names(text: string, userFoods: readonly FoodItem[] = [], page = 1, pageSize = 20): Promise<string[]> {
  const result = await provider(userFoods).search({ text, page, pageSize })
  return result.items.map((item) => item.name)
}

describe('local catalog search ranking', () => {
  it('ranks exact > prefix > word > substring', async () => {
    const foods = [
      testFood('Cheese, grilled sandwich'),
      testFood('Cheese'),
      testFood('Mozzarella cheese'),
      testFood('Cheeseburger'),
      testFood('Macaroni and cheesecake'),
    ]
    const local = createLocalCatalogProvider({ catalog: foods, getUserFoods: () => [] })
    const result = await local.search({ text: 'cheese', page: 1, pageSize: 10 })
    expect(result.items.map((item) => item.name)).toEqual([
      'Cheese',
      'Cheeseburger',
      'Cheese, grilled sandwich',
      'Mozzarella cheese',
      'Macaroni and cheesecake',
    ])
  })

  it('matches word prefixes while typing and requires every query word', async () => {
    // Same score: the shorter (more specific) name first.
    expect(await names('chick')).toEqual([
      'Chickpeas, cooked',
      'Chicken thigh, roasted (skinless)',
      'Chicken breast, roasted (skinless)',
    ])
    expect(await names('chicken thigh')).toEqual(['Chicken thigh, roasted (skinless)'])
    expect(await names('roasted chicken')).toHaveLength(2)
  })

  it('treats word order as secondary for exact matches ("cheese cheddar")', async () => {
    expect((await names('cheese cheddar'))[0]).toBe('Cheddar cheese')
  })

  it('folds plurals and singulars both ways', async () => {
    expect(await names('strawberry')).toEqual(['Strawberries'])
    expect(await names('tomatoes')).toEqual(['Tomato'])
    expect(await names('chickpea')).toEqual(['Chickpeas, cooked'])
    expect((await names('berries')).sort()).toEqual(['Blueberries', 'Strawberries'])
  })

  it.each([
    ['yoghurt', 'Greek yogurt, plain, low-fat'],
    ['chumus', 'Hummus'],
    ['humus', 'Hummus'],
    ['felafel', 'Falafel'],
    ['bourekas', 'Cheese burekas'],
    ['pitta', 'Pita bread'],
    ['shwarma', 'Shawarma in pita'],
    ['tehina', 'Tahini (sesame paste)'],
    ['חומוס', 'Hummus'],
  ])('resolves the alias "%s"', async (query, expected) => {
    expect((await names(query))[0]).toBe(expected)
  })

  it('ignores accents and punctuation', async () => {
    expect(await names('creme fraiche')).toEqual(['Crème fraîche'])
    expect(await names('  COTTAGE, cheese!! ')).toEqual(['Cottage cheese (about 4% fat)'])
  })

  it('boosts the user’s own foods within the same kind of match, never above an exact match', async () => {
    const userHummus = testFood('Hummus with pine nuts', { id: 'user-hummus', source: 'custom', createdBy: 'u1' })
    const userPita = testFood('Pita, whole wheat', { id: 'user-pita', source: 'custom', createdBy: 'u1' })
    expect(await names('hummus', [userHummus])).toEqual(['Hummus', 'Hummus with pine nuts'])
    expect((await names('pita', [userPita]))[0]).toBe('Pita, whole wheat')
  })

  it('matches brands of user foods, below name matches', async () => {
    const branded = testFood('Classic spread', { id: 'u-spread', brand: 'Achla', createdBy: 'u1', source: 'off' })
    expect(await names('achla', [branded])).toEqual(['Classic spread'])
  })

  it('returns nothing for blank or punctuation-only queries and for no matches', async () => {
    expect(await names('   ')).toEqual([])
    expect(await names('?!')).toEqual([])
    expect(await names('zzzz')).toEqual([])
  })
})

describe('local catalog search pagination and resilience', () => {
  const many = Array.from({ length: 45 }, (_, i) => testFood(`Rice dish ${String(i).padStart(2, '0')}`))
  const local = createLocalCatalogProvider({ catalog: () => many, getUserFoods: () => [] })

  it('pages deterministically with hasMore', async () => {
    const first = await local.search({ text: 'rice', page: 1, pageSize: 20 })
    const third = await local.search({ text: 'rice', page: 3, pageSize: 20 })
    expect(first.items).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    expect(first.items[0]?.name).toBe('Rice dish 00')
    expect(third.items.map((item) => item.name)).toEqual(['Rice dish 40', 'Rice dish 41', 'Rice dish 42', 'Rice dish 43', 'Rice dish 44'])
    expect(third.hasMore).toBe(false)
    expect(third.page).toBe(3)
  })

  it('falls back to the catalog when user foods cannot be read', async () => {
    const failing = createLocalCatalogProvider({
      catalog: TEST_CATALOG,
      getUserFoods: () => Promise.reject(new Error('IndexedDB blocked')),
    })
    const result = await failing.search({ text: 'falafel', page: 1, pageSize: 5 })
    expect(result.items.map((item) => item.name)).toEqual(['Falafel'])
  })

  it('does not list a user copy and the catalog item with the same id twice', async () => {
    const copy = { ...TEST_CATALOG[7]!, createdBy: 'u1' }
    expect(await names('falafel', [copy])).toEqual(['Falafel'])
  })

  it('rejects with the abort reason when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('stop', 'AbortError'))
    await expect(provider().search({ text: 'pita', page: 1, pageSize: 5, signal: controller.signal })).rejects.toThrow('stop')
  })

  it('reuses the catalog index between searches', async () => {
    const getter = vi.fn<() => readonly FoodItem[]>(() => TEST_CATALOG)
    const local2 = createLocalCatalogProvider({ catalog: getter, getUserFoods: () => [] })
    await local2.search({ text: 'pita', page: 1, pageSize: 5 })
    await local2.search({ text: 'hummus', page: 1, pageSize: 5 })
    expect(getter).toHaveBeenCalledTimes(2)
    expect(local2.isAvailable()).toBe(true)
  })
})

describe('local barcode lookup', () => {
  it('finds user and catalog foods by barcode regardless of leading zeros', async () => {
    const saved = testFood('Cheerios', { id: 'u-cheerios', barcode: '0016000275287', source: 'off', createdBy: 'u1' })
    const local = provider([saved])
    expect((await local.lookupBarcode('016000275287'))?.id).toBe('u-cheerios')
    expect(await local.lookupBarcode('7290000000008')).toBeNull()
    expect(await local.lookupBarcode('not-a-code')).toBeNull()
  })
})
