import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  TODAY,
  region,
  registerProgressTestHooks,
  renderProgress,
  seedWeighIns,
  setupProgress,
  statText,
  storedWeights,
  weightInput,
} from './testing/progressHarness'

registerProgressTestHooks()

function weighInCard() {
  return region('Log a weigh-in')
}

function field(name: RegExp | string) {
  return within(weighInCard()).getByLabelText(name)
}

describe('Progress: logging a weigh-in', () => {
  beforeEach(async () => {
    await setupProgress()
  })

  it('saves a weigh-in and updates stats and history', async () => {
    const { user } = await renderProgress()
    expect(screen.getByRole('heading', { level: 2, name: 'Start your weight trend' })).toBeInTheDocument()
    expect(field(/Date/)).toHaveValue(TODAY)
    expect(field(/Time/)).toHaveValue('07:30')

    await user.type(weightInput(), '71.2')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Add a note' }))
    await user.type(field(/Note/), 'Before breakfast')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Save weigh-in' }))

    expect(await screen.findByText('Weigh-in saved')).toBeInTheDocument()
    expect(screen.getByText('71.2 kg · Today, 7:30 AM')).toBeInTheDocument()
    expect(statText('Current')).toContain('71.2kg')
    expect(statText('Current')).toContain('Today')
    expect(statText('Weekly change')).toContain('Needs about a week of weigh-ins')
    expect(screen.queryByRole('heading', { name: 'Start your weight trend' })).not.toBeInTheDocument()

    const history = region('History')
    const today = within(history).getByRole('listitem', { name: 'Today' })
    expect(within(today).getByText('71.2 kg')).toBeInTheDocument()
    expect(within(today).getByText('7:30 AM')).toBeInTheDocument()
    expect(within(today).getByText('Before breakfast')).toBeInTheDocument()

    expect(weightInput()).toHaveValue('')
    expect(await storedWeights()).toMatchObject([
      { weightKg: 71.2, inputUnit: 'kg', date: TODAY, note: 'Before breakfast' },
    ])
  })

  it('shows field errors and saves nothing for invalid input', async () => {
    const { user } = await renderProgress()
    const save = within(weighInCard()).getByRole('button', { name: 'Save weigh-in' })

    await user.click(save)
    expect(within(weighInCard()).getByText('Enter your weight.')).toBeInTheDocument()
    expect(weightInput()).toHaveAttribute('aria-invalid', 'true')
    expect(weightInput()).toHaveFocus()

    await user.type(weightInput(), '12')
    await user.click(save)
    expect(within(weighInCard()).getByText('Enter a weight between 20 and 400 kg.')).toBeInTheDocument()

    await user.clear(weightInput())
    await user.type(weightInput(), '70')
    await user.clear(field(/Date/))
    await user.type(field(/Date/), '2026-10-08')
    await user.click(save)
    expect(within(weighInCard()).getByText('Choose today or an earlier date.')).toBeInTheDocument()
    expect(field(/Date/)).toHaveFocus()

    await user.clear(field(/Date/))
    await user.type(field(/Date/), TODAY)
    await user.clear(field(/Time/))
    await user.type(field(/Time/), '21:15')
    await user.click(save)
    expect(within(weighInCard()).getByText('Choose a time up to now.')).toBeInTheDocument()

    expect(await storedWeights()).toEqual([])
    expect(screen.getByRole('heading', { level: 2, name: 'Start your weight trend' })).toBeInTheDocument()
  })

  it('logs an earlier day with its own date and time', async () => {
    const { user } = await renderProgress()
    await user.type(weightInput(), '70.4')
    await user.clear(field(/Date/))
    await user.type(field(/Date/), '2026-10-05')
    await user.clear(field(/Time/))
    await user.type(field(/Time/), '06:45')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Save weigh-in' }))

    expect(await screen.findByText('70.4 kg · Mon, Oct 5, 6:45 AM')).toBeInTheDocument()
    const day = within(region('History')).getByRole('listitem', { name: 'Mon, Oct 5' })
    expect(within(day).getByText('6:45 AM')).toBeInTheDocument()
    const [stored] = await storedWeights()
    expect(stored?.date).toBe('2026-10-05')
    expect(new Date(stored?.measuredAt ?? '').getHours()).toBe(6)
  })
})

describe('Progress: imperial units', () => {
  it('accepts pounds and stores kilograms', async () => {
    await setupProgress({ unitSystem: 'imperial' })
    const { user } = await renderProgress()
    expect(within(weighInCard()).getByText('lb')).toBeInTheDocument()

    await user.type(weightInput(), '30')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Save weigh-in' }))
    expect(within(weighInCard()).getByText('Enter a weight between 45 and 881 lb.')).toBeInTheDocument()

    await user.clear(weightInput())
    await user.type(weightInput(), '157')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Save weigh-in' }))

    expect(await screen.findByText('Weigh-in saved')).toBeInTheDocument()
    expect(statText('Current')).toContain('157.0lb')
    expect(await storedWeights()).toMatchObject([{ weightKg: 71.21, inputUnit: 'lb' }])
  })
})

describe('Progress: a second weigh-in on the same day', () => {
  beforeEach(async () => {
    await setupProgress()
    await seedWeighIns([{ date: TODAY, weightKg: 71.2, time: '07:05' }])
  })

  it('says so neutrally and marks the weigh-in the chart uses', async () => {
    const { user } = await renderProgress()
    const notice =
      "You've already logged 71.2 kg this morning — adding another is fine; the chart uses your first weigh-in of the day."
    expect(within(weighInCard()).getByText(notice)).toBeInTheDocument()

    await user.clear(field(/Date/))
    await user.type(field(/Date/), '2026-10-06')
    expect(within(weighInCard()).queryByText(notice)).not.toBeInTheDocument()
    await user.clear(field(/Date/))
    await user.type(field(/Date/), TODAY)

    await user.type(weightInput(), '71.6')
    await user.click(within(weighInCard()).getByRole('button', { name: 'Save weigh-in' }))
    expect(await screen.findByText('Weigh-in saved')).toBeInTheDocument()

    const today = within(region('History')).getByRole('listitem', { name: 'Today' })
    const rows = within(today).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('71.6 kg7:30 AM')
    expect(rows[1]).toHaveTextContent('71.2 kg7:05 AMUsed in chart')
    // The chart (and so "Current") keeps the first weigh-in of the day.
    expect(statText('Current')).toContain('71.2kg')
    await waitFor(async () => expect(await storedWeights()).toHaveLength(2))
  })
})
