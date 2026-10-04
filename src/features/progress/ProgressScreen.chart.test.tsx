import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MINOR_BIRTH_DATE,
  TODAY,
  region,
  registerProgressTestHooks,
  renderProgress,
  seedDailySeries,
  seedWeighIns,
  setupProgress,
} from './testing/progressHarness'

registerProgressTestHooks()

type User = Awaited<ReturnType<typeof renderProgress>>['user']

function chartCard() {
  return region('Weight trend')
}

async function openTable(user: User) {
  await user.click(within(chartCard()).getByRole('button', { name: 'Show data table' }))
  return within(chartCard()).getByRole('table', { name: /Plotted weights/ })
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole('row').slice(1)
}

function columnNames(table: HTMLElement) {
  return within(table)
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
}

describe('Progress chart: ranges and the data table', () => {
  it('plots one point per day of the selected range', async () => {
    await setupProgress()
    // 40 days of weigh-ins: 80.0 kg on Aug 29 … 76.1 kg today.
    await seedDailySeries(40, 80, -0.1)
    const { user } = await renderProgress()

    const figure = within(chartCard()).getByRole('figure', { name: 'Weight trend' })
    expect(figure).toHaveAccessibleDescription(/^Last 30 days: 30 weigh-in days, from 79\.0 kg on Tue, Sep 8 to 76\.1 kg today\./)
    expect(within(chartCard()).getByRole('radio', { name: '30 days' })).toBeChecked()

    const table = await openTable(user)
    expect(columnNames(table)).toEqual(['Date', 'Weigh-in (kg)', '7-day trend (kg)'])
    expect(dataRows(table)).toHaveLength(30)

    await user.click(within(chartCard()).getByRole('radio', { name: '7 days' }))
    expect(dataRows(within(chartCard()).getByRole('table'))).toHaveLength(7)
    const latest = dataRows(within(chartCard()).getByRole('table')).at(-1)!
    expect(within(latest).getByRole('rowheader')).toHaveTextContent('Today')
    expect(within(latest).getAllByRole('cell')[0]).toHaveTextContent('76.1')
    expect(figure).toHaveAccessibleDescription(/^Last 7 days: 7 weigh-in days/)

    await user.click(within(chartCard()).getByRole('radio', { name: 'All time' }))
    expect(dataRows(within(chartCard()).getByRole('table'))).toHaveLength(40)

    await user.click(within(chartCard()).getByRole('button', { name: 'Hide data table' }))
    expect(within(chartCard()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('offers All time when the range has no weigh-ins', async () => {
    await setupProgress()
    await seedWeighIns([{ date: '2026-08-01', weightKg: 74 }])
    const { user } = await renderProgress()

    expect(within(chartCard()).getByText('No weigh-ins in the last 30 days')).toBeInTheDocument()
    await user.click(within(chartCard()).getByRole('button', { name: 'Show all time' }))
    expect(within(chartCard()).getByRole('radio', { name: 'All time' })).toBeChecked()
    const table = await openTable(user)
    expect(within(dataRows(table)[0]!).getByRole('rowheader')).toHaveTextContent('Sat, Aug 1')
  })

  it('switches to weekly averages for long histories', async () => {
    await setupProgress()
    await seedWeighIns([
      { date: '2025-06-01', weightKg: 82 },
      { date: '2026-10-01', weightKg: 78 },
      { date: TODAY, weightKg: 77.6 },
    ])
    const { user } = await renderProgress()
    await user.click(within(chartCard()).getByRole('radio', { name: 'All time' }))

    expect(within(chartCard()).getByText('Weekly averages')).toBeInTheDocument()
    const table = await openTable(user)
    expect(columnNames(table)).toEqual(['Date', 'Weekly average (kg)', '7-day trend (kg)'])
    const latest = dataRows(table).at(-1)!
    expect(within(latest).getByRole('rowheader')).toHaveTextContent('Week ending today')
    // Mean of Oct 1 (78.0) and today (77.6).
    expect(within(latest).getAllByRole('cell')[0]).toHaveTextContent('77.8')
  })
})

describe('Progress chart: target trajectory', () => {
  it('draws the target pace only for an adult with a safe weight-change goal', async () => {
    await setupProgress({ goal: 'lose_weight', goalPace: 'gentle', targetWeightKg: 74 })
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()

    expect(within(chartCard()).getByRole('list', { name: 'Chart key' })).toHaveTextContent('Target pace (estimate)')
    const figure = within(chartCard()).getByRole('figure')
    expect(figure).toHaveAccessibleDescription(/Target pace line reaches \d+\.\d kg by /)
    const table = await openTable(user)
    expect(columnNames(table)).toEqual(['Date', 'Weigh-in (kg)', '7-day trend (kg)', 'Target pace (kg)'])
    // 10 logged days + 30 projected days.
    expect(dataRows(table)).toHaveLength(40)
    const projected = dataRows(table).at(-1)!
    expect(within(projected).getByRole('rowheader')).toHaveTextContent('Fri, Nov 6')
    expect(within(projected).getAllByRole('cell')[0]).toHaveTextContent('none')
    expect(within(projected).getAllByRole('cell')[2]).toHaveTextContent(/^\d+\.\d$/)
  })

  it('shows no target pace when the target points the other way', async () => {
    await setupProgress({ goal: 'lose_weight', targetWeightKg: 85 })
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()

    expect(within(chartCard()).getByRole('list', { name: 'Chart key' })).not.toHaveTextContent('Target pace')
    const table = await openTable(user)
    expect(columnNames(table)).toEqual(['Date', 'Weigh-in (kg)', '7-day trend (kg)'])
    expect(dataRows(table)).toHaveLength(10)
  })

  it('never shows a target or weight-change goals to someone under 18', async () => {
    await setupProgress({ birthDate: MINOR_BIRTH_DATE, goal: 'lose_weight', targetWeightKg: 60 })
    await seedDailySeries(10, 64, -0.05)
    const { user } = await renderProgress()

    expect(within(chartCard()).getByRole('list', { name: 'Chart key' })).not.toHaveTextContent('Target pace')
    const table = await openTable(user)
    expect(columnNames(table)).not.toContain('Target pace (kg)')
    expect(within(region('Your numbers')).queryByText('To target')).not.toBeInTheDocument()

    const goal = region('Goal settings')
    expect(within(goal).getByText(/weight tracking here is wellness-focused/)).toBeInTheDocument()
    const options = within(within(goal).getByRole('combobox', { name: 'Goal' }))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['General wellness', 'Maintain weight', 'Build muscle'])
    expect(within(goal).queryByRole('textbox', { name: /Target weight/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Estimated around/)).not.toBeInTheDocument()
  })
})
