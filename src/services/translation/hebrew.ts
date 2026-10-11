/**
 * Hebrew text helpers for search translation: detection, normalization and the few morphological variants that
 * matter for food words — attached prefixes (ו, ה, ב, ל, מ, ש, כ and their combinations) and plural / construct
 * endings. Variants are only candidates: the dictionary decides which of them is a real word.
 */
const HEBREW_LETTER = /[א-ת]/
const NIQQUD = /[֑-ׇ]/g

export function containsHebrew(text: string): boolean {
  return HEBREW_LETTER.test(text)
}

/** Invisible direction marks that RTL keyboards and copy-paste insert. */
const BIDI_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

/** Without niqqud, cantillation and direction marks; Hebrew punctuation (geresh/gershayim) as ASCII, maqaf as space. */
export function normalizeHebrew(text: string): string {
  return text
    .normalize('NFC')
    .replace(BIDI_MARKS, '')
    .replace(NIQQUD, '')
    .replace(/[׳’‘`]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[־\-–—_/,;:!?()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FINAL_FORMS: Readonly<Record<string, string>> = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' }

/** A word whose last letter takes its final form (after removing an ending: "תפוחים" → "תפוח"). */
function withFinalLetter(word: string): string {
  const last = word.at(-1) ?? ''
  const final = FINAL_FORMS[last]
  return final ? `${word.slice(0, -1)}${final}` : word
}

/** Prefix letters a Hebrew word may carry, longest combinations first. */
const PREFIXES = ['וכש', 'וש', 'וה', 'וב', 'ול', 'ומ', 'שה', 'שב', 'של', 'מה', 'בה', 'לה', 'כש', 'ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'] as const

/** Endings → replacements tried for singular/absolute forms ("עגבניות" → "עגבנייה", "ביצת" → "ביצה"). */
const ENDINGS: readonly (readonly [string, readonly string[]])[] = [
  ['יות', ['יה', 'ייה']],
  ['ות', ['ה', 'ת', '']],
  ['ים', ['', 'ה']],
  ['ת', ['ה']],
  ['ה', ['']],
  ['י', ['']],
]

/** The word without (or with fewer) prefix letters; each candidate keeps at least two letters. */
export function withoutPrefixes(word: string): string[] {
  const results: string[] = []
  for (const prefix of PREFIXES) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) results.push(word.slice(prefix.length))
  }
  return results
}

/** Singular / absolute-state candidates of a word. */
export function singularForms(word: string): string[] {
  const results: string[] = []
  for (const [ending, replacements] of ENDINGS) {
    if (!word.endsWith(ending) || word.length - ending.length < 2) continue
    const stem = word.slice(0, -ending.length)
    for (const replacement of replacements) results.push(replacement === '' ? withFinalLetter(stem) : `${stem}${replacement}`)
  }
  return results
}

/** The word itself first, then prefix-less, singular and prefix-less singular forms (no duplicates). */
export function wordVariants(word: string): string[] {
  const variants = [word, ...withoutPrefixes(word)]
  for (const base of [...variants]) variants.push(...singularForms(base))
  return [...new Set(variants)]
}
