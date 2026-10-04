/**
 * Shared class recipes for pill buttons. Kept outside the component files so links or custom
 * triggers can look like buttons without duplicating classes.
 */
export const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'subtle', 'danger'] as const
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const
export type ButtonSize = (typeof BUTTON_SIZES)[number]

export const BUTTON_BASE =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
  'transition-[background-color,color,box-shadow,transform] duration-150 ease-out-soft ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:active:scale-100 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:shrink-0'

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-card hover:bg-primary/90',
  secondary: 'border border-border bg-surface text-text shadow-thumb hover:bg-surface-2',
  ghost: 'bg-transparent text-text hover:bg-text/6',
  subtle: 'bg-primary/10 text-primary hover:bg-primary/16',
  danger: 'bg-danger text-danger-foreground shadow-card hover:bg-danger/90',
}

/** Heights: sm 36 px (with an invisible 44 px hit area), md 44 px, lg 52 px. */
export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'hit-area h-9 px-3.5 text-sm [&_svg]:size-4',
  md: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
  lg: 'h-13 px-6 text-base [&_svg]:size-5',
}

export const ICON_BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'hit-area size-9 [&_svg]:size-4',
  md: 'size-11 [&_svg]:size-5',
  lg: 'size-13 [&_svg]:size-6',
}
