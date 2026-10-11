import { describe, expect, it, vi } from 'vitest'
import { cleanTranslation, createMyMemoryTranslator, MYMEMORY_ENDPOINT, type MachineTranslator } from './machine'
import { createQueryTranslator } from './queryTranslator'

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ok = (text: string) => reply({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: text } })

describe('MyMemory machine translation', () => {
  it('asks for Hebrew → English and cleans the answer', async () => {
    const fetchImpl = vi.fn<(url: string) => Promise<Response>>(async () => ok('Passion Fruit Juice.'))
    const translator = createMyMemoryTranslator(fetchImpl)
    expect(await translator.translate('מיץ פסיפלורה')).toBe('passion fruit juice')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${MYMEMORY_ENDPOINT}?q=${encodeURIComponent('מיץ פסיפלורה')}&langpair=he|en`)
  })

  it('returns null on errors, quota limits, warnings and untranslated text', async () => {
    const answers = [
      reply({}, 500),
      reply({ responseStatus: 429, responseData: { translatedText: 'x' } }),
      reply({ responseStatus: 200, quotaFinished: true, responseData: { translatedText: 'x' } }),
      ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS'),
      ok('פסיפלורה'),
    ]
    for (const answer of answers) {
      expect(await createMyMemoryTranslator(async () => answer).translate('פסיפלורה')).toBeNull()
    }
    const offline = createMyMemoryTranslator(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await offline.translate('פסיפלורה')).toBeNull()
  })

  it('rethrows when the caller aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const translator = createMyMemoryTranslator(async (_url, init) => {
      init?.signal?.throwIfAborted()
      return ok('x')
    })
    await expect(translator.translate('פסיפלורה', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('cleans markup and punctuation', () => {
    expect(cleanTranslation('a', '<b>Rice</b> & beans!')).toBe('rice & beans')
    expect(cleanTranslation('a', '')).toBeNull()
    expect(cleanTranslation('a', 42)).toBeNull()
  })
})

describe('query translator', () => {
  const machine = (answer: string | null): MachineTranslator & { calls: number } => {
    const fake = { calls: 0, translate: async () => (fake.calls += 1, answer) }
    return fake
  }

  it('uses the dictionary alone when it knows every word', async () => {
    const mt = machine('should not be used')
    const translator = createQueryTranslator({ machine: mt })
    expect(await translator.translate('חזה עוף')).toMatchObject({ query: 'chicken breast', source: 'dictionary' })
    expect(mt.calls).toBe(0)
  })

  it('completes unknown words with machine translation and caches it', async () => {
    const mt = machine('passion fruit juice')
    const translator = createQueryTranslator({ machine: mt })
    expect(await translator.translate('מיץ פסיפלורה')).toEqual({ original: 'מיץ פסיפלורה', query: 'passion fruit juice', source: 'machine', unknown: [] })
    await translator.translate('מיץ פסיפלורה')
    expect(mt.calls).toBe(1)
  })

  it('falls back to the partial dictionary translation offline or when machine translation fails', async () => {
    const offline = createQueryTranslator({ machine: machine('x'), isOnline: () => false })
    expect(await offline.translate('מיץ פסיפלורה')).toMatchObject({ query: 'juice', source: 'partial', unknown: ['פסיפלורה'] })
    const failing = machine(null)
    const translator = createQueryTranslator({ machine: failing })
    expect(await translator.translate('מיץ פסיפלורה')).toMatchObject({ source: 'partial' })
    await translator.translate('מיץ פסיפלורה')
    expect(failing.calls).toBe(2)
  })

  it('leaves other languages alone', async () => {
    expect(await createQueryTranslator({ machine: null }).translate('oats')).toBeNull()
  })
})
