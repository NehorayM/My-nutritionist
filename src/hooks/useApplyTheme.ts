import { useEffect } from 'react'
import { useUiStore, type ResolvedTheme, type ThemePreference } from '@/stores/uiStore'
import { useMediaQuery } from './useMediaQuery'

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/** Browser UI color per theme; equals the `bg` token (keep in sync with index.css and index.html). */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#faf6ef',
  dark: '#111814',
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** The theme currently in effect ('system' resolved through the OS setting, live). */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useUiStore((state) => state.theme)
  const systemPrefersDark = useMediaQuery(DARK_SCHEME_QUERY)
  return resolveTheme(preference, systemPrefersDark)
}

/** Writes the theme to the document: `data-theme` on <html> and every `<meta name="theme-color">`. */
export function applyThemeToDocument(theme: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLORS[theme]
  }
}

/** Mount once at the app root: keeps the document theme in sync with the preference and the OS. */
export function useApplyTheme(): ResolvedTheme {
  const theme = useResolvedTheme()
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])
  return theme
}
