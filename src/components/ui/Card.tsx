import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type CardVariant = 'raised' | 'flat' | 'outline' | 'tinted'

const VARIANT_CLASSES: Record<CardVariant, string> = {
  raised: 'bg-surface shadow-card ring-1 ring-border/70',
  flat: 'bg-surface-2',
  outline: 'border border-border bg-transparent',
  tinted: 'bg-primary/8 ring-1 ring-primary/15',
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  /** Render as <section> (with a heading inside) or <article> for standalone items. */
  as?: 'div' | 'section' | 'article' | 'li'
}

/** Rounded content container (20 px radius). Compose with CardHeader / CardContent / CardFooter. */
export function Card({ variant = 'raised', as: Element = 'div', className, ...rest }: CardProps) {
  return <Element className={cn('rounded-card', VARIANT_CLASSES[variant], className)} {...rest} />
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Trailing content such as an IconButton or a Badge. */
  action?: ReactNode
}

export function CardHeader({ action, className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3 px-5 pt-5', className)} {...rest}>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      {action ? <div className="-my-1.5 -mr-2 flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4'
}

export function CardTitle({ as: Heading = 'h3', className, ...rest }: CardTitleProps) {
  return <Heading className={cn('text-base font-bold leading-snug tracking-tight text-text', className)} {...rest} />
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-text-muted', className)} {...rest} />
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 border-t border-border/70 px-5 py-3', className)}
      {...rest}
    />
  )
}
