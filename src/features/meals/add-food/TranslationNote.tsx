import { Languages } from 'lucide-react'
import type { QueryTranslation } from '@/services/translation'

interface TranslationNoteProps {
  translation: QueryTranslation | null | undefined
}

/**
 * Says which English text a Hebrew search was sent as (the food databases are in English). Mixed Hebrew/English
 * text is isolated with <bdi> so each part keeps its own direction.
 */
export function TranslationNote({ translation }: TranslationNoteProps) {
  if (!translation) return null
  const { query, source, unknown } = translation
  return (
    <p className="flex items-start gap-2 rounded-field bg-surface-2 px-3 py-2 text-sm text-text" data-testid="translation-note">
      <Languages aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
      <span>
        {query ? (
          <>
            Searching in English for “<bdi dir="ltr" className="font-semibold">{query}</bdi>”
            <span className="text-text-muted">{source === 'machine' ? ' · translated automatically' : ' · translated from Hebrew'}</span>
          </>
        ) : (
          <>Couldn’t translate this search, so only foods on this device are shown.</>
        )}
        {unknown.length > 0 ? (
          <span className="block text-text-muted">
            Not translated: <bdi dir="rtl" lang="he">{unknown.join(' ')}</bdi>
          </span>
        ) : null}
      </span>
    </p>
  )
}
