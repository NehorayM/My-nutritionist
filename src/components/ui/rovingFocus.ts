import type { KeyboardEvent } from 'react'

export type RovingOrientation = 'horizontal' | 'vertical' | 'both'

/**
 * Index to move to for a roving-tabindex key press (arrows wrap, Home/End jump), skipping
 * disabled items. Returns null when the key is not a navigation key.
 */
export function nextRovingIndex(
  event: KeyboardEvent,
  current: number,
  disabled: readonly boolean[],
  orientation: RovingOrientation = 'horizontal',
): number | null {
  const count = disabled.length
  if (count === 0) return null
  const forward = orientation === 'vertical' ? ['ArrowDown'] : orientation === 'both' ? ['ArrowRight', 'ArrowDown'] : ['ArrowRight']
  const backward = orientation === 'vertical' ? ['ArrowUp'] : orientation === 'both' ? ['ArrowLeft', 'ArrowUp'] : ['ArrowLeft']

  let step: number
  let start: number
  if (forward.includes(event.key)) [step, start] = [1, current]
  else if (backward.includes(event.key)) [step, start] = [-1, current]
  else if (event.key === 'Home') [step, start] = [1, -1]
  else if (event.key === 'End') [step, start] = [-1, count]
  else return null

  for (let offset = 1; offset <= count; offset += 1) {
    const index = (((start + step * offset) % count) + count) % count
    if (!disabled[index]) return index
  }
  return null
}
