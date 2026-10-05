import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { hasRepositories, setRepositories } from '@/services/runtime'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { WelcomeScreen } from './WelcomeScreen'

beforeEach(async () => {
  await deleteDatabase()
  useSessionStore.setState({ phase: 'welcome', mode: null, userId: null, email: null })
  useSyncStore.setState({ authNotice: null })
})

afterEach(() => setRepositories(null))

describe('WelcomeScreen', () => {
  it('validates the sign-in form before contacting the server', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Create account' }))
    await user.type(screen.getByLabelText('Email'), 'dana@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
  })

  it('switches to the password reset form and back', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows and dismisses an auth notice', async () => {
    const user = userEvent.setup()
    useSyncStore.setState({ authNotice: 'That link has expired. Request a new one.' })
    render(<WelcomeScreen />)
    expect(screen.getByText('That link has expired. Request a new one.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('That link has expired. Request a new one.')).not.toBeInTheDocument()
  })

  it('continues as a guest with local storage', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Continue as guest' }))
    await expect.poll(() => useSessionStore.getState().mode).toBe('guest')
    expect(hasRepositories()).toBe(true)
  })
})
