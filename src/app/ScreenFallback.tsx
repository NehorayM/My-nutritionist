import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'

/** Suspense fallback while a screen's code loads: header-shaped skeleton plus an announced status. */
export function ScreenFallback({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="px-5 pt-5">
      <h1 className="text-title font-extrabold text-text">{label}</h1>
      <output className="mt-2 flex items-center gap-2 text-sm text-text-muted">
        <Spinner className="size-4" />
        Loading…
      </output>
      <div className="mt-6 space-y-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
    </div>
  )
}
