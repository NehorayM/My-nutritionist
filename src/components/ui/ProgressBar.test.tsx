import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'
import { ProgressRing } from './ProgressRing'
import { measureProgress, progressAria } from './progressMath'

function fillWidth(bar: HTMLElement): string {
  const fill = bar.firstElementChild
  if (!(fill instanceof HTMLElement)) throw new Error('missing fill')
  return fill.style.width
}

describe('ProgressBar', () => {
  it('exposes progressbar semantics with value, range and spoken value text', () => {
    render(<ProgressBar label="Protein" value={62} max={110} valueText="62 of 110 g" tone="protein" />)
    const bar = screen.getByRole('progressbar', { name: 'Protein' })
    expect(bar).toHaveAttribute('aria-valuenow', '62')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '110')
    expect(bar).toHaveAttribute('aria-valuetext', '62 of 110 g')
    expect(fillWidth(bar)).toBe(`${(62 / 110) * 100}%`)
    expect(bar).not.toHaveAttribute('data-over')
    expect(screen.queryByTestId('progress-over')).not.toBeInTheDocument()
  })

  it('above 100% clamps aria-valuenow to the target, caps the fill and shows an over-target marker', () => {
    render(<ProgressBar label="Calories" value={2300} max={2000} valueText="2,300 of 2,000 kcal, 300 over" />)
    const bar = screen.getByRole('progressbar', { name: 'Calories' })
    expect(bar).toHaveAttribute('aria-valuenow', '2000')
    expect(bar).toHaveAttribute('aria-valuemax', '2000')
    expect(bar).toHaveAttribute('aria-valuetext', '2,300 of 2,000 kcal, 300 over')
    expect(fillWidth(bar)).toBe('100%')
    expect(bar).toHaveAttribute('data-over', 'true')
    // 300 of the 2,300 kcal lie beyond the target → the striped tail covers that share of the bar.
    expect(screen.getByTestId('progress-over').style.width).toBe(`${(300 / 2300) * 100}%`)
  })

  it('is indeterminate when the value or the target is unknown', () => {
    render(
      <>
        <ProgressBar label="Vitamin D" value={null} max={15} valueText="Not enough data" />
        <ProgressBar label="Fiber" value={12} max={0} valueText="12 g, no target" />
      </>,
    )
    for (const name of ['Vitamin D', 'Fiber']) {
      const bar = screen.getByRole('progressbar', { name })
      expect(bar).not.toHaveAttribute('aria-valuenow')
      expect(bar).not.toHaveAttribute('aria-valuemax')
      expect(fillWidth(bar)).toBe('0%')
    }
    expect(screen.getByRole('progressbar', { name: 'Vitamin D' })).toHaveAttribute('aria-valuetext', 'Not enough data')
  })
})

describe('ProgressRing', () => {
  it('uses the same semantics and keeps the center content decorative', () => {
    render(
      <ProgressRing label="Calories" value={2600} max={2000} valueText="2,600 of 2,000 kcal">
        <span>2,600</span>
      </ProgressRing>,
    )
    const ring = screen.getByRole('progressbar', { name: 'Calories' })
    expect(ring).toHaveAttribute('aria-valuenow', '2000')
    expect(ring).toHaveAttribute('aria-valuetext', '2,600 of 2,000 kcal')
    expect(ring).toHaveAttribute('data-over', 'true')
    expect(screen.getByText('2,600').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('draws an overflow lap only above the target', () => {
    const { container, rerender } = render(<ProgressRing label="Calories" value={1500} max={2000} valueText="1,500 of 2,000 kcal" />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    rerender(<ProgressRing label="Calories" value={2500} max={2000} valueText="2,500 of 2,000 kcal" />)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
  })
})

describe('measureProgress / progressAria', () => {
  it('clamps fractions and measures overflow', () => {
    expect(measureProgress(50, 200)).toMatchObject({ fraction: 0.25, isOver: false, determinate: true })
    expect(measureProgress(300, 200)).toMatchObject({ fraction: 1, over: 100, overFraction: 0.5, isOver: true })
    expect(measureProgress(400, 200).overShare).toBe(0.5)
    expect(measureProgress(200, 200)).toMatchObject({ isOver: false, overShare: 0 })
    expect(measureProgress(900, 200).overFraction).toBe(1)
    expect(measureProgress(-5, 200)).toMatchObject({ fraction: 0, over: 0 })
    expect(measureProgress(5, Number.NaN).determinate).toBe(false)
    expect(measureProgress(5, -1).determinate).toBe(false)
  })

  it('keeps aria-valuenow inside 0…max', () => {
    expect(progressAria(-10, 100)).toEqual({ role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 })
    expect(progressAria(150, 100)['aria-valuenow']).toBe(100)
    expect(progressAria(null, 100)).toEqual({ role: 'progressbar' })
    expect(progressAria(40, null)).toEqual({ role: 'progressbar' })
  })
})
