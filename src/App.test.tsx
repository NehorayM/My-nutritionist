import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { installMatchMedia } from '@/hooks/testMediaQuery'
import { notify } from '@/lib/notify'
import { resetUiStore, useUiStore } from '@/stores/uiStore'
import App from './App'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  resetUiStore()
})

describe('App', () => {
  it('composes the routed shell, the notification area and the document theme', async () => {
    installMatchMedia({ '(prefers-color-scheme: dark)': true })
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Meals' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => useUiStore.getState().setTheme('light'))
    expect(document.documentElement.dataset.theme).toBe('light')

    act(() => {
      notify.info('Saved on this device')
    })
    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
    act(() => notify.dismiss())
  })
})
