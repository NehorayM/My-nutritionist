/** Shared look for text-like form controls (Input, NumberInput, Select, Textarea). */
export const CONTROL_BASE =
  'w-full min-w-0 rounded-field border border-border bg-surface text-[1rem] text-text shadow-thumb ' +
  'placeholder:text-text-muted/70 transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-text-muted/50 focus-visible:border-primary focus-visible:outline-none ' +
  'focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25 motion-reduce:transition-none'

/** 44 px tall single-line controls; 16 px text avoids iOS zoom-on-focus. */
export const CONTROL_HEIGHT = 'h-11 px-3.5'
