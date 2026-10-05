import { describe, expect, it } from 'vitest'
import { profile } from './__fixtures__/adaptive'
import { containsPhrase, resolvePreferences } from './preferences'

describe('resolvePreferences', () => {
  it('uses app defaults before onboarding', () => {
    expect(resolvePreferences(null)).toEqual({
      dietType: 'balanced',
      allergies: [],
      dislikes: [],
      preferredCuisines: [],
      maxPrepMinutes: 30,
      cookingSkill: 'intermediate',
    })
  })

  it('copies the profile fields, trimming dislikes and dropping blank ones', () => {
    const person = profile({
      dietType: 'vegan',
      allergies: ['peanuts'],
      dislikes: ['  olives ', '', '   '],
      preferredCuisines: ['italian'],
      maxPrepMinutes: 15,
      cookingSkill: 'beginner',
    })
    const prefs = resolvePreferences(person)
    expect(prefs).toEqual({
      dietType: 'vegan',
      allergies: ['peanuts'],
      dislikes: ['olives'],
      preferredCuisines: ['italian'],
      maxPrepMinutes: 15,
      cookingSkill: 'beginner',
    })
    expect(prefs.allergies).not.toBe(person.allergies)
  })

  it('falls back to the default prep limit for invalid values but keeps 0', () => {
    expect(resolvePreferences(profile({ maxPrepMinutes: Number.NaN })).maxPrepMinutes).toBe(30)
    expect(resolvePreferences(profile({ maxPrepMinutes: -5 })).maxPrepMinutes).toBe(30)
    expect(resolvePreferences(profile({ maxPrepMinutes: 0 })).maxPrepMinutes).toBe(0)
  })
})

describe('containsPhrase', () => {
  it('matches whole words case-insensitively', () => {
    expect(containsPhrase('Egg, hard-boiled', 'EGG')).toBe(true)
    expect(containsPhrase('Eggplant, roasted', 'egg')).toBe(false)
  })

  it('treats underscores and punctuation as word breaks', () => {
    expect(containsPhrase('protein egg_white', 'egg')).toBe(true)
    expect(containsPhrase('fast_food', 'fast food')).toBe(true)
  })

  it('matches simple plurals both ways', () => {
    expect(containsPhrase('Eggs, scrambled', 'egg')).toBe(true)
    expect(containsPhrase('Tomato', 'tomatoes')).toBe(true)
    expect(containsPhrase('Blueberries', 'blueberry')).toBe(true)
    expect(containsPhrase('Swiss cheese', 'swis')).toBe(false)
  })

  it('needs multi-word phrases in order and adjacent', () => {
    expect(containsPhrase('Peanut butter, smooth', 'peanut butter')).toBe(true)
    expect(containsPhrase('Butter with peanut', 'peanut butter')).toBe(false)
  })

  it('never matches an empty phrase', () => {
    expect(containsPhrase('Anything', '  ')).toBe(false)
    expect(containsPhrase('Anything', '!!')).toBe(false)
  })
})
