import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { TONE_SOFT, type Tone } from './tones'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: 'sm' | 'md'
  icon?: ReactNode
}

/** Small non-interactive label (source, status, diet flag). Text must carry the meaning, not only color. */
export function Badge({ tone = 'neutral', size = 'sm', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full font-semibold leading-none [&_svg]:shrink-0',
        size === 'sm' ? 'h-6 px-2.5 text-xs [&_svg]:size-3.5' : 'h-7 px-3 text-sm [&_svg]:size-4',
        TONE_SOFT[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}
