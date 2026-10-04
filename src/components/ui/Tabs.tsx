import { useId, useMemo, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { useControllableState } from '@/hooks/useControllableState'
import { cn } from './cn'
import { nextRovingIndex } from './rovingFocus'
import { TabsContext, tabIds, useTabsContext } from './tabsContext'

interface TabsProps {
  /** Controlled selected tab. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: ReactNode
}

/** ARIA tabs: TabList > Tab, plus one TabPanel per tab. Arrow keys move and activate tabs. */
export function Tabs({ value, defaultValue = '', onValueChange, className, children }: TabsProps) {
  const [selected, select] = useControllableState({ value, defaultValue, onChange: onValueChange })
  const idBase = `tabs-${useId().replace(/:/g, '')}`
  const context = useMemo(() => ({ value: selected, select, idBase }), [selected, select, idBase])
  return (
    <TabsContext value={context}>
      <div className={className}>{children}</div>
    </TabsContext>
  )
}

interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the tab list. */
  label: string
}

export function TabList({ label, className, onKeyDown, children, ...rest }: TabListProps) {
  const { select } = useTabsContext('TabList')

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const current = tabs.findIndex((tab) => tab === document.activeElement)
    if (current < 0) return
    const next = nextRovingIndex(event, current, tabs.map((tab) => tab.disabled))
    if (next === null) return
    event.preventDefault()
    const target = tabs[next]
    target?.focus()
    const value = target?.dataset.value
    if (value !== undefined) select(value)
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn('flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'id'> {
  value: string
  disabled?: boolean
  icon?: ReactNode
}

export function Tab({ value, disabled = false, icon, className, children, onClick, ...rest }: TabProps) {
  const { value: selected, select, idBase } = useTabsContext('Tab')
  const ids = tabIds(idBase, value)
  const isSelected = selected === value
  return (
    <button
      type="button"
      role="tab"
      id={ids.tab}
      data-value={value}
      aria-selected={isSelected}
      aria-controls={ids.panel}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) select(value)
      }}
      className={cn(
        'relative inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[0.9375rem] font-semibold',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:transition-colors',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        isSelected ? 'text-primary after:bg-primary' : 'text-text-muted after:bg-transparent hover:text-text',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  value: string
  /** Keep the panel mounted while hidden (preserves form state). Default false. */
  keepMounted?: boolean
}

export function TabPanel({ value, keepMounted = false, className, children, ...rest }: TabPanelProps) {
  const { value: selected, idBase } = useTabsContext('TabPanel')
  const ids = tabIds(idBase, value)
  const isSelected = selected === value
  if (!isSelected && !keepMounted) return null
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      hidden={!isSelected}
      tabIndex={0}
      className={cn('focus-visible:outline-offset-4', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
