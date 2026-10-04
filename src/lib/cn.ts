import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom theme scales from index.css, so tailwind-merge resolves conflicts correctly: without them
 * `text-display` is mistaken for a color (and dropped next to `text-text`) and `rounded-card` never
 * yields to a `rounded-full` override.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'title', 'display'],
      radius: ['field', 'card', 'card-lg', 'sheet', 'frame'],
      shadow: ['thumb', 'card', 'raised', 'frame'],
      ease: ['out-soft'],
      animate: ['fade-in', 'fade-out', 'sheet-in', 'sheet-out', 'pop-in', 'pop-out', 'screen-in'],
    },
  },
})

/** Compose class names; later Tailwind utilities override earlier ones (theme-aware). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
