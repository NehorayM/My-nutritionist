import { createContext, useContext } from 'react'

export interface TabsContextValue {
  value: string
  select: (value: string) => void
  idBase: string
}

export const TabsContext = createContext<TabsContextValue | null>(null)

export function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) throw new Error(`<${component}> must be used inside <Tabs>`)
  return context
}

/** Stable DOM ids linking a tab to its panel. Values are slugged to stay valid id characters. */
export function tabIds(idBase: string, value: string): { tab: string; panel: string } {
  const slug = value.replace(/[^A-Za-z0-9_-]/g, '_')
  return { tab: `${idBase}-tab-${slug}`, panel: `${idBase}-panel-${slug}` }
}
