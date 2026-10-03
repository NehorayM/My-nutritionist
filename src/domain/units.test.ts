import { describe, expect, it } from 'vitest'
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, roundTo } from './units'

describe('units', () => {
  it('converts kilograms and pounds both ways', () => {
    expect(roundTo(kgToLb(70), 1)).toBe(154.3)
    expect(roundTo(lbToKg(154.3), 1)).toBe(70)
    expect(lbToKg(kgToLb(82.4))).toBeCloseTo(82.4, 10)
  })

  it('converts height between centimeters and feet/inches', () => {
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 })
    expect(cmToFeetInches(152.4)).toEqual({ feet: 5, inches: 0 })
    expect(roundTo(feetInchesToCm(5, 11), 1)).toBe(180.3)
  })

  it('rounds half away from floating point error', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(2.345, 1)).toBe(2.3)
    expect(roundTo(-1.25, 1)).toBe(-1.2)
  })
})
