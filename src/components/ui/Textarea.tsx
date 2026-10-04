import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from './cn'
import { CONTROL_BASE } from './controlStyles'
import { useFieldControlProps } from './fieldContext'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, rows = 3, ref, ...props }: TextareaProps) {
  const wired = useFieldControlProps(props)
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL_BASE, 'min-h-24 resize-y px-3.5 py-2.5 leading-relaxed', className)}
      {...wired}
    />
  )
}
