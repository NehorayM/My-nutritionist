import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'

type Range = '7d' | '30d' | 'all'

const OPTIONS: SegmentedOption<Range>[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
]

function Harness({ onChange, options = OPTIONS }: { onChange?: (value: Range) => void; options?: SegmentedOption<Range>[] }) {
  const [value, setValue] = useState<Range>('7d')
  return (
    <>
      <button type="button">Before</button>
      <SegmentedControl
        label="Chart range"
        value={value}
        options={options}
        onValueChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <button type="button">After</button>
    </>
  )
}

describe('SegmentedControl', () => {
  it('renders a named radio group with the current option checked', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Chart range' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '30 days' })).not.toBeChecked()
  })

  it('is a single tab stop', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Before' }))
    await userEvent.tab()
    expect(screen.getByRole('radio', { name: '7 days' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('moves focus and selection with arrow keys, wrapping at the ends', async () => {
    const onChange = vi.fn<(value: Range) => void>()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '7 days' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '30 days' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'All time' })).toBeChecked()
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['30d', 'all', '7d', 'all'])
  })

  it('selects on click and skips disabled options', async () => {
    const onChange = vi.fn<(value: Range) => void>()
    const options: SegmentedOption<Range>[] = [OPTIONS[0]!, { ...OPTIONS[1]!, disabled: true }, OPTIONS[2]!]
    render(<Harness onChange={onChange} options={options} />)
    await userEvent.click(screen.getByRole('radio', { name: '30 days' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('radio', { name: '7 days' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'All time' })).toBeChecked()
  })
})
