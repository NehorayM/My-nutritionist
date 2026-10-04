import { describe, expect, it } from 'vitest'
import { axisDateLabel, chartTicks, hasTarget, pointDateLabel, toChartData, yScale, type ChartDatum } from './chartModel'
import { chartSummary } from './chartSummary'

const TODAY = '2026-10-07'

function row(date: string, weight: number | null, trend: number | null = null, target: number | null = null): ChartDatum {
  return { date, weight, trend, target }
}

describe('toChartData', () => {
  it('converts to the display unit and drops rows with nothing to plot', () => {
    const data = toChartData(
      [
        { date: '2026-10-05', weightKg: 70, trendKg: 70, targetKg: null },
        { date: '2026-10-06', weightKg: null, trendKg: null, targetKg: null },
        { date: '2026-10-07', weightKg: null, trendKg: 69.8, targetKg: 69.8 },
      ],
      'lb',
    )
    expect(data).toEqual([row('2026-10-05', 154.32, 154.32), row('2026-10-07', null, 153.88, 153.88)])
    expect(hasTarget(data)).toBe(true)
    expect(hasTarget(data.slice(0, 1))).toBe(false)
  })
})

describe('chartTicks', () => {
  const days = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`)

  it('labels every point of a short series', () => {
    expect(chartTicks(days.slice(0, 7), 'day', 1)).toEqual(days.slice(0, 7))
  })

  it('labels week starts per the user setting', () => {
    expect(chartTicks(days, 'day', 1)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(chartTicks(days, 'day', 0)).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  })

  it('thins long series to at most six labels', () => {
    expect(chartTicks(days, 'week', 1).length).toBeLessThanOrEqual(6)
  })
})

describe('yScale', () => {
  it('pads the range onto whole-number ticks', () => {
    expect(yScale([row('a', 71.2, 71.4), row('b', 72.1, null, 70)])).toEqual({ domain: [69, 73], ticks: [69, 70, 71, 72, 73] })
    expect(yScale([row('a', null)])).toBeNull()
  })

  it('uses wider steps for wide ranges', () => {
    const scale = yScale([row('a', 150), row('b', 190)])
    expect(scale).toEqual({ domain: [140, 200], ticks: [140, 160, 180, 200] })
  })
})

describe('date labels', () => {
  it('labels days, weeks and axis ticks', () => {
    expect(pointDateLabel(TODAY, 'day', TODAY)).toBe('Today')
    expect(pointDateLabel(TODAY, 'week', TODAY)).toBe('Week ending today')
    expect(pointDateLabel('2026-09-27', 'week', TODAY)).toBe('Week ending Sun, Sep 27')
    expect(axisDateLabel('2026-09-27', 'day')).toBe('Sep 27')
    expect(axisDateLabel('2026-09-27', 'week')).toBe('Sep 2026')
  })
})

describe('chartSummary', () => {
  const options = { range: '30d' as const, granularity: 'day' as const, unit: 'kg' as const, today: TODAY }

  it('describes the plotted weigh-ins, the trend and the target line', () => {
    const data = [row('2026-10-05', 72, 72), row('2026-10-07', 71.5, 71.75, 71.75), row('2026-11-06', null, null, 70.9)]
    expect(chartSummary(data, options)).toBe(
      'Last 30 days: 2 weigh-in days, from 72.0 kg on Mon, Oct 5 to 71.5 kg today. 7-day average 71.8 kg. Target pace line reaches 70.9 kg by Fri, Nov 6.',
    )
  })

  it('handles a single weigh-in and an empty range', () => {
    expect(chartSummary([row(TODAY, 71.5)], { ...options, range: '7d' })).toBe('Last 7 days: 1 weigh-in day, 71.5 kg today.')
    expect(chartSummary([row('2026-10-06', 71.5)], { ...options, range: 'all', granularity: 'week' })).toBe(
      'All time: 1 weekly average, 71.5 kg in the week ending yesterday.',
    )
    expect(chartSummary([], options)).toBe('Last 30 days: no weigh-ins in this period. Try a longer range to see earlier ones.')
  })
})
