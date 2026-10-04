import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  TODAY,
  region,
  registerProgressTestHooks,
  renderProgress,
  seedDailySeries,
  seedWeighIns,
  setupProgress,
  statText,
  storedWeights,
} from './testing/progressHarness'

registerProgressTestHooks()

function history() {
  return region('History')
}

function day(name: string) {
  return within(history()).getByRole('listitem', { name })
}

describe('Progress history: edit and delete', () => {
  beforeEach(async () => {
    await setupProgress()
    await seedWeighIns([
      { date: '2026-10-06', weightKg: 71.6, time: '07:10', note: 'Late dinner' },
      { date: TODAY, weightKg: 71.2, time: '07:05' },
    ])
  })

  it('edits a weigh-in in a sheet', async () => {
    const { user } = await renderProgress()
    expect(within(day('Yesterday')).getByText('Late dinner')).toBeInTheDocument()

    await user.click(within(history()).getByRole('button', { name: 'Edit weigh-in, Yesterday 7:10 AM' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit weigh-in' })
    const weight = within(sheet).getByRole('textbox', { name: /Weight/ })
    expect(weight).toHaveValue('71.6')
    expect(within(sheet).getByRole('textbox', { name: /Note/ })).toHaveValue('Late dinner')

    await user.clear(weight)
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    expect(within(sheet).getByText('Enter your weight.')).toBeInTheDocument()

    await user.type(weight, '71.4')
    await user.clear(within(sheet).getByRole('textbox', { name: /Note/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Weigh-in updated')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit weigh-in' })).not.toBeInTheDocument())
    expect(within(day('Yesterday')).getByText('71.4 kg')).toBeInTheDocument()
    expect(within(day('Yesterday')).queryByText('Late dinner')).not.toBeInTheDocument()
    const stored = (await storedWeights()).find((entry) => entry.date === '2026-10-06')
    expect(stored).toMatchObject({ weightKg: 71.4, note: null })
  })

  it('cancelling an edit keeps the saved values', async () => {
    const { user } = await renderProgress()
    await user.click(within(history()).getByRole('button', { name: 'Edit weigh-in, Today 7:05 AM' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit weigh-in' })
    await user.clear(within(sheet).getByRole('textbox', { name: /Weight/ }))
    await user.type(within(sheet).getByRole('textbox', { name: /Weight/ }), '90')
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(day('Today')).getByText('71.2 kg')).toBeInTheDocument()
    expect((await storedWeights()).map((entry) => entry.weightKg).sort()).toEqual([71.2, 71.6])
  })

  it('deletes after confirmation and restores with Undo', async () => {
    const { user } = await renderProgress()
    expect(statText('Current')).toContain('71.2kg')

    await user.click(within(history()).getByRole('button', { name: 'Delete weigh-in, Today 7:05 AM' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this weigh-in?' })
    expect(confirm).toHaveTextContent('71.2 kg · Today, 7:05 AM. You can undo this right after.')
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Weigh-in deleted')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(history()).queryByRole('listitem', { name: 'Today' })).not.toBeInTheDocument()
    expect(statText('Current')).toContain('71.6kg')
    expect(await storedWeights()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Weigh-in restored')).toBeInTheDocument()
    expect(within(day('Today')).getByText('71.2 kg')).toBeInTheDocument()
    expect(statText('Current')).toContain('71.2kg')
    expect(await storedWeights()).toHaveLength(2)
  })

  it('keeps the weigh-in when deletion is cancelled', async () => {
    const { user } = await renderProgress()
    await user.click(within(history()).getByRole('button', { name: 'Delete weigh-in, Yesterday 7:10 AM' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(day('Yesterday')).getByText('71.6 kg')).toBeInTheDocument()
    expect(await storedWeights()).toHaveLength(2)
  })
})

describe('Progress history: long lists', () => {
  it('shows the latest week first and reveals earlier days on request', async () => {
    await setupProgress()
    await seedDailySeries(10, 72, -0.1)
    const { user } = await renderProgress()

    const days = () => within(history()).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(days()).toEqual(['Today', 'Yesterday', 'Mon, Oct 5', 'Sun, Oct 4', 'Sat, Oct 3', 'Fri, Oct 2', 'Thu, Oct 1'])

    await user.click(within(history()).getByRole('button', { name: 'Show earlier days (3 more)' }))
    expect(days()).toHaveLength(10)
    expect(days().at(-1)).toBe('Mon, Sep 28')
    expect(within(history()).queryByRole('button', { name: /Show earlier days/ })).not.toBeInTheDocument()
  })
})
