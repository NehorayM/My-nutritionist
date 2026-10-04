import { createElement, lazy, type ComponentType } from 'react'

type ScreenModule = { default: ComponentType }

export interface ScreenEntry {
  Component: ComponentType
  /** Starts loading the screen's code (no-op for eagerly bundled screens). */
  preload: () => void
}

/**
 * React.lazy caches a rejected import forever, so a screen whose chunk failed to load (offline,
 * new deploy) could never recover. This wrapper swaps in a fresh lazy component after a load error,
 * so the error boundary's "Try again" re-requests the chunk.
 */
export function lazyScreen(load: () => Promise<ScreenModule>): ScreenEntry {
  let pending: Promise<ScreenModule> | null = null
  const loadOnce = (): Promise<ScreenModule> => {
    pending ??= load().catch((error: unknown) => {
      pending = null
      current = lazy(loadOnce)
      throw error
    })
    return pending
  }
  let current = lazy(loadOnce)

  function LazyScreen() {
    return createElement(current)
  }

  return {
    Component: LazyScreen,
    preload: () => {
      loadOnce().catch(() => undefined)
    },
  }
}

export function eagerScreen(Component: ComponentType): ScreenEntry {
  return { Component, preload: () => undefined }
}
