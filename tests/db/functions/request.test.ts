import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  MAX_BODY_CHARS,
  parseFoodSearchRequest,
  parseJsonBody,
} from '../../../supabase/functions/food-search/request.ts'

describe('parseFoodSearchRequest — search', () => {
  it('accepts a full search request and normalizes whitespace in the query', () => {
    expect(parseFoodSearchRequest({ action: 'search', query: '  chicken \n  breast ', page: 2, pageSize: 10, scope: 'branded' }))
      .toEqual({ ok: true, value: { action: 'search', query: 'chicken breast', page: 2, pageSize: 10, scope: 'branded' } })
  })

  it('defaults page, pageSize and scope (generic foods)', () => {
    expect(parseFoodSearchRequest({ action: 'search', query: 'oats' })).toEqual({
      ok: true,
      value: { action: 'search', query: 'oats', page: 1, pageSize: DEFAULT_PAGE_SIZE, scope: 'generic' },
    })
  })

  it.each([
    ['a missing query', { action: 'search' }],
    ['a numeric query', { action: 'search', query: 42 }],
    ['a 1-character query', { action: 'search', query: ' a ' }],
    ['a 101-character query', { action: 'search', query: 'x'.repeat(101) }],
    ['page 0', { action: 'search', query: 'rice', page: 0 }],
    ['page 51', { action: 'search', query: 'rice', page: 51 }],
    ['a fractional page', { action: 'search', query: 'rice', page: 1.5 }],
    ['a page given as text', { action: 'search', query: 'rice', page: '2' }],
    ['pageSize 0', { action: 'search', query: 'rice', pageSize: 0 }],
    ['pageSize 51', { action: 'search', query: 'rice', pageSize: 51 }],
    ['an unknown scope', { action: 'search', query: 'rice', scope: 'restaurants' }],
    ['a null scope', { action: 'search', query: 'rice', scope: null }],
  ])('rejects %s', (_label, body) => {
    expect(parseFoodSearchRequest(body)).toMatchObject({ ok: false })
  })

  it('accepts the boundary values', () => {
    const query = 'x'.repeat(100)
    expect(parseFoodSearchRequest({ action: 'search', query, page: 50, pageSize: 50 })).toMatchObject({
      ok: true,
      value: { query, page: 50, pageSize: 50 },
    })
    expect(parseFoodSearchRequest({ action: 'search', query: 'ab', page: 1, pageSize: 1 })).toMatchObject({ ok: true })
  })
})

describe('parseFoodSearchRequest — food and envelope', () => {
  it('accepts a positive integer fdcId', () => {
    expect(parseFoodSearchRequest({ action: 'food', fdcId: 171477 })).toEqual({ ok: true, value: { action: 'food', fdcId: 171477 } })
  })

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 17.5],
    ['text', '171477'],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 2],
  ])('rejects a %s fdcId', (_label, fdcId) => {
    expect(parseFoodSearchRequest({ action: 'food', fdcId })).toMatchObject({ ok: false })
  })

  it.each([
    ['null', null],
    ['an array', [{ action: 'search', query: 'rice' }]],
    ['a string', 'search rice'],
    ['an unknown action', { action: 'delete', query: 'rice' }],
  ])('rejects %s as the body', (_label, body) => {
    expect(parseFoodSearchRequest(body)).toMatchObject({ ok: false })
  })
})

describe('parseJsonBody', () => {
  it('parses JSON text', () => {
    expect(parseJsonBody('{"action":"food","fdcId":1}')).toEqual({ ok: true, value: { action: 'food', fdcId: 1 } })
  })

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['malformed', '{"action":'],
    ['oversized', `{"query":"${'x'.repeat(MAX_BODY_CHARS)}"}`],
  ])('rejects an %s body', (_label, text) => {
    expect(parseJsonBody(text)).toMatchObject({ ok: false })
  })
})
