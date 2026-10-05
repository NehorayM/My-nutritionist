import { describe, expect, it, vi } from 'vitest'
import type { ConnectionState } from '@/types'
import { createManualTimers } from './__fixtures__/manualTimers'
import { createConnectivityMonitor, type ConnectivityOptions } from './connectivity'

const CONFIG = { configured: true as const, url: 'https://abc.supabase.co', key: 'sb_publishable_test' }

/** fetch stub: each call takes the next scripted outcome; 'hang' waits until the request is aborted. */
function scriptedFetch(...outcomes: ('ok' | 503 | 'network' | 'hang')[]) {
  return vi.fn<typeof fetch>((_input, init) => {
    const outcome = outcomes.shift() ?? 'ok'
    if (outcome === 'ok') return Promise.resolve(new Response('{}', { status: 200 }))
    if (outcome === 503) return Promise.resolve(new Response('', { status: 503 }))
    if (outcome === 'network') return Promise.reject(new TypeError('Failed to fetch'))
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  })
}

function setup(fetchImpl: typeof fetch, overrides: Partial<ConnectivityOptions> = {}) {
  const timers = createManualTimers()
  const events = new EventTarget()
  const monitor = createConnectivityMonitor({ config: CONFIG, fetchImpl, timers, events, isBrowserOnline: () => true, ...overrides })
  const states: ConnectionState[] = []
  monitor.subscribe((state) => states.push(state))
  return { monitor, timers, events, states }
}

describe('connectivity monitor', () => {
  it('is permanently unconfigured without Supabase settings and never makes a request', async () => {
    const fetchImpl = scriptedFetch()
    for (const config of [null, { configured: false as const, reason: 'missing' as const }]) {
      const monitor = createConnectivityMonitor({ config, fetchImpl, events: null })
      expect(monitor.getState()).toBe('unconfigured')
      expect(await monitor.verify()).toBe('unconfigured')
      monitor.dispose()
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports connected only after a real health request succeeds', async () => {
    const fetchImpl = scriptedFetch('ok')
    const { monitor, states } = setup(fetchImpl)
    expect(monitor.getState()).toBe('checking')
    expect(await monitor.verify()).toBe('connected')
    expect(states).toEqual(['connected'])
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://abc.supabase.co/auth/v1/health')
    expect(init).toMatchObject({ method: 'GET', headers: { apikey: 'sb_publishable_test' }, cache: 'no-store' })
  })

  it('shares one request between concurrent checks', async () => {
    const fetchImpl = scriptedFetch('ok')
    const { monitor } = setup(fetchImpl)
    const results = await Promise.all([monitor.verify(), monitor.verify(), monitor.verify()])
    expect(results).toEqual(['connected', 'connected', 'connected'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('goes offline on network errors and error responses, then re-checks with backoff', async () => {
    const fetchImpl = scriptedFetch('network', 503, 'ok')
    const { monitor, timers, states } = setup(fetchImpl)
    expect(await monitor.verify()).toBe('offline')
    expect(timers.scheduled()).toEqual([5_000])
    timers.advance(5_000)
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(timers.scheduled()).toEqual([10_000]))
    expect(monitor.getState()).toBe('offline')
    timers.advance(10_000)
    await vi.waitFor(() => expect(monitor.getState()).toBe('connected'))
    expect(timers.scheduled()).toEqual([])
    expect(states).toEqual(['offline', 'checking', 'offline', 'checking', 'connected'])
  })

  it('treats a check that does not answer within 5 s as offline', async () => {
    const { monitor, timers } = setup(scriptedFetch('hang'))
    const result = monitor.verify()
    timers.advance(4_999)
    expect(monitor.getState()).toBe('checking')
    timers.advance(1)
    expect(await result).toBe('offline')
  })

  it('stays connected while re-checking and drops to offline only when the check fails', async () => {
    const { monitor, states } = setup(scriptedFetch('ok', 'network'))
    await monitor.verify()
    const recheck = monitor.verify()
    expect(monitor.getState()).toBe('connected')
    expect(await recheck).toBe('offline')
    expect(states).toEqual(['connected', 'offline'])
  })

  it('follows browser offline/online events and ignores results of checks started before going offline', async () => {
    let resolveFirst = (_response: Response): void => undefined
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(new Response('{}', { status: 200 }))
    const { monitor, events, timers } = setup(fetchImpl)
    const stale = monitor.verify()
    events.dispatchEvent(new Event('offline'))
    expect(monitor.getState()).toBe('offline')
    resolveFirst(new Response('{}', { status: 200 }))
    expect(await stale).toBe('offline')
    expect(timers.scheduled()).toEqual([])

    events.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(monitor.getState()).toBe('connected'))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not send requests while the browser reports no network', async () => {
    const fetchImpl = scriptedFetch('ok')
    const { monitor, timers } = setup(fetchImpl, { isBrowserOnline: () => false })
    expect(monitor.getState()).toBe('offline')
    expect(await monitor.verify()).toBe('offline')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(timers.scheduled()).toEqual([])
  })

  it('stops listening and re-checking after dispose', async () => {
    const fetchImpl = scriptedFetch('network')
    const { monitor, events, timers, states } = setup(fetchImpl)
    await monitor.verify()
    monitor.dispose()
    expect(timers.scheduled()).toEqual([])
    events.dispatchEvent(new Event('online'))
    expect(await monitor.verify()).toBe('offline')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(states).toEqual(['offline'])
  })
})
