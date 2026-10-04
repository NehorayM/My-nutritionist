import { useMediaQuery } from './useMediaQuery'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** True when the user asked the OS to minimize motion — use it to disable JS-driven animation (e.g. charts). */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
