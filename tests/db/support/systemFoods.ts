import { readFileSync } from 'node:fs'

/** Ids of the bundled system catalog (src/data/system-foods.json), the source of migration 003. */
export function readSystemFoodIds(): string[] {
  const url = new URL('../../../src/data/system-foods.json', import.meta.url)
  const parsed: unknown = JSON.parse(readFileSync(url, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || !('foods' in parsed) || !Array.isArray(parsed.foods)) {
    throw new Error('src/data/system-foods.json has no foods array')
  }
  return parsed.foods.map((food: unknown) => {
    if (typeof food !== 'object' || food === null || !('id' in food) || typeof food.id !== 'string') {
      throw new Error('A system food has no string id')
    }
    return food.id
  })
}

const SYSTEM_FOOD_IDS = readSystemFoodIds()
let cursor = Math.floor(Math.random() * SYSTEM_FOOD_IDS.length)

/** A system food id; consecutive calls in one file never repeat (until the catalog is exhausted). */
export function nextSystemFoodId(): string {
  const id = SYSTEM_FOOD_IDS[cursor % SYSTEM_FOOD_IDS.length]
  cursor += 1
  if (id === undefined) throw new Error('The system catalog is empty')
  return id
}
