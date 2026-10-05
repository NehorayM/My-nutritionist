import { formatNutrient } from '@/lib/format'
import { MACRO_KEYS, type MacroKey } from '@/types'

const INK: Record<MacroKey, string> = {
  protein: 'text-protein-ink',
  carbs: 'text-carbs-ink',
  fat: 'text-fat-ink',
  fiber: 'text-fiber-ink',
}

/** "20 g protein · 8 g carbs · 4 g fat · 0 g fiber" with each amount in its macro color ("—" when unknown). */
export function MacroLine({ amounts }: { amounts: Record<MacroKey, number | null> }) {
  return (
    <span className="flex flex-wrap gap-x-2.5 text-xs text-text-muted">
      {MACRO_KEYS.map((key) => (
        <span key={key} className="whitespace-nowrap">
          <span className={`font-semibold ${INK[key]}`}>{formatNutrient(key, amounts[key])}</span> {key}
        </span>
      ))}
    </span>
  )
}
