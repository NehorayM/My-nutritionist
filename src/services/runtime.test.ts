import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories/local'
import type { Repositories } from '@/repositories/types'
import { getRepositories, hasRepositories, setRepositories, subscribeRepositories } from './runtime'

afterEach(() => setRepositories(null))

describe('repository runtime', () => {
  it('throws a clear error before repositories are set', () => {
    setRepositories(null)
    expect(hasRepositories()).toBe(false)
    expect(() => getRepositories()).toThrow('Repositories are not initialized yet')
  })

  it('notifies subscribers when the active repositories change, until they unsubscribe', () => {
    const listener = vi.fn<(repositories: Repositories | null) => void>()
    const unsubscribe = subscribeRepositories(listener)
    const repositories = createLocalRepositories(newId())
    setRepositories(repositories)
    expect(listener).toHaveBeenLastCalledWith(repositories)
    expect(getRepositories()).toBe(repositories)
    unsubscribe()
    setRepositories(null)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
