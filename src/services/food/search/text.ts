/**
 * Search text normalization shared by local search ranking and cross-provider de-duplication.
 * Pure and deterministic. Handles accents ("crème" → "creme"), Hebrew niqqud, punctuation,
 * simple English plurals and common spelling variants of everyday / Israeli foods.
 */

/** Spelling variants → canonical token. Hebrew spellings map to the English catalog names. */
export const SEARCH_ALIASES: Readonly<Record<string, string>> = {
  yoghurt: 'yogurt',
  yoghourt: 'yogurt',
  chumus: 'hummus',
  humus: 'hummus',
  houmous: 'hummus',
  hommus: 'hummus',
  homous: 'hummus',
  felafel: 'falafel',
  bourekas: 'burekas',
  borekas: 'burekas',
  boureka: 'burekas',
  bureka: 'burekas',
  pitta: 'pita',
  shwarma: 'shawarma',
  shawerma: 'shawarma',
  schawarma: 'shawarma',
  shuarma: 'shawarma',
  tehina: 'tahini',
  tahina: 'tahini',
  techina: 'tahini',
  shakshouka: 'shakshuka',
  chakchouka: 'shakshuka',
  'חומוס': 'hummus',
  'פלאפל': 'falafel',
  'בורקס': 'burekas',
  'פיתה': 'pita',
  'שווארמה': 'shawarma',
  'שוורמה': 'shawarma',
  'טחינה': 'tahini',
  'שקשוקה': 'shakshuka',
  'יוגורט': 'yogurt',
}

/** Lowercase, accents/niqqud removed, punctuation → spaces, whitespace collapsed. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim()
}

const KEEP_FINAL_S = /(ss|us|is)$/

/**
 * Tiny English stemmer that folds plural/singular pairs onto one stem:
 * berries/berry → "berri", cookies/cookie → "cooki", tomatoes → "tomato", peaches → "peach", oats → "oat".
 * Stems are only compared with each other, never shown. Non-latin tokens are returned unchanged.
 */
export function stemToken(token: string): string {
  if (token.length < 3 || /[^a-z]/.test(token)) return token
  if (token.endsWith('ies')) return `${token.slice(0, -3)}i`
  if (token.endsWith('ie')) return `${token.slice(0, -2)}i`
  if (token.endsWith('y')) return `${token.slice(0, -1)}i`
  if (token.endsWith('oes')) return token.slice(0, -2)
  if (/(ch|sh|x|ss)es$/.test(token)) return token.slice(0, -2)
  if (token.endsWith('s') && !KEEP_FINAL_S.test(token)) return token.slice(0, -1)
  return token
}

/** Alias + plural folding so "yoghurts", "yogurt" and "יוגורט" share one token. */
export function canonicalToken(token: string): string {
  const alias = SEARCH_ALIASES[token] ?? SEARCH_ALIASES[stemToken(token)]
  return stemToken(alias ?? token)
}

/** Canonical tokens in input order (duplicates kept). */
export function searchTokens(text: string): string[] {
  const normalized = normalizeSearchText(text)
  return normalized === '' ? [] : normalized.split(' ').map(canonicalToken)
}

/** Order-insensitive identity of a name: "Cheese, cheddar" ≡ "Cheddar cheese". */
export function nameIdentityKey(name: string, brand: string | null): string {
  const tokens = [...new Set(searchTokens(name))].sort().join(' ')
  const brandTokens = brand === null ? '' : searchTokens(brand).join(' ')
  return `${tokens}|${brandTokens}`
}
