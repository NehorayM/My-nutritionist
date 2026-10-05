import { X } from 'lucide-react'
import { useState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import { COUNT_LIMITS, TEXT_LIMITS } from '@/schemas'

interface DislikesInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

/** Free-text foods to avoid; matched against food names and tags in suggestions. */
export function DislikesInput({ value, onChange }: DislikesInputProps) {
  const [text, setText] = useState('')
  const full = value.length >= COUNT_LIMITS.dislikes

  function add(): void {
    const word = text.trim().slice(0, TEXT_LIMITS.dislike)
    if (!word || full) return
    if (!value.some((existing) => existing.toLowerCase() === word.toLowerCase())) onChange([...value, word])
    setText('')
  }

  return (
    <div className="grid gap-2">
      <Field label="Foods you'd rather skip" optional hint={full ? 'That list is full — remove one to add another.' : 'For example: mushrooms, olives.'}>
        <Input
          value={text}
          maxLength={TEXT_LIMITS.dislike}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          trailing={
            <Button type="button" size="sm" variant="ghost" onClick={add} disabled={!text.trim() || full}>
              Add
            </Button>
          }
        />
      </Field>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Foods you'd rather skip">
          {value.map((word) => (
            <li key={word} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm">
              <span className="max-w-[12rem] truncate">{word}</span>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full text-text-muted hover:bg-border/60 focus-visible:outline-2"
                aria-label={`Remove ${word}`}
                onClick={() => onChange(value.filter((item) => item !== word))}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
