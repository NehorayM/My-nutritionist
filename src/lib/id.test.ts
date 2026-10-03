import { describe, expect, it } from 'vitest'
import { favoriteId, isUuid, newId, systemFoodId, userFoodId, uuidV5 } from './id'

describe('ids', () => {
  it('generates random v4 UUIDs', () => {
    const a = newId()
    const b = newId()
    expect(isUuid(a)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('matches the RFC 4122 v5 reference vector', async () => {
    // DNS namespace + "www.example.com" → 2ed6657d-e927-568b-95e1-2665a8aea6a2 (Python uuid.uuid5)
    await expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).resolves.toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
  })

  it('derives stable, user-scoped food ids', async () => {
    const first = await userFoodId('user-a', 'usda', '171477')
    expect(await userFoodId('user-a', 'usda', '171477')).toBe(first)
    expect(await userFoodId('user-b', 'usda', '171477')).not.toBe(first)
    expect(isUuid(first)).toBe(true)
  })

  it('derives deterministic favorite and system food ids', async () => {
    expect(await favoriteId('u1', 'f1')).toBe(await favoriteId('u1', 'f1'))
    expect(await favoriteId('u1', 'f1')).not.toBe(await favoriteId('u2', 'f1'))
    expect(await systemFoodId('banana')).toBe(await systemFoodId('banana'))
    expect(await systemFoodId('banana')).not.toBe(await systemFoodId('apple'))
  })

  it('rejects non-UUID strings', () => {
    expect(isUuid('guest')).toBe(false)
    expect(isUuid('6f1c3d5e-2b7a-5c48-9e0f-4a1b2c3d4e5')).toBe(false)
  })
})
