import { CloudCheck, CloudOff, HardDrive, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { hashFor } from './routes'

interface BadgeModel {
  label: string
  detail: string
  icon: typeof CloudCheck
  tone: 'ok' | 'muted' | 'warn'
}

function model(mode: string | null, connection: string, pending: number, failed: number, syncing: boolean): BadgeModel {
  if (mode !== 'cloud') return { label: 'On this device', detail: 'Guest mode · not backed up', icon: HardDrive, tone: 'muted' }
  if (failed > 0) return { label: `${failed} change${failed === 1 ? '' : 's'} need attention`, detail: 'Review in Profile', icon: TriangleAlert, tone: 'warn' }
  if (connection === 'offline') return { label: 'Offline', detail: pending > 0 ? `${pending} waiting to sync` : 'Saved on this device', icon: CloudOff, tone: 'warn' }
  if (syncing || connection === 'checking') return { label: 'Syncing…', detail: 'Saving to your account', icon: LoaderCircle, tone: 'muted' }
  if (pending > 0) return { label: `${pending} waiting to sync`, detail: 'Saved on this device', icon: RefreshCw, tone: 'muted' }
  return { label: 'Synced', detail: 'Backed up to your account', icon: CloudCheck, tone: 'ok' }
}

/** Compact sync/storage status for the side navigation (details and actions live in Profile). */
export function SyncBadge() {
  const mode = useSessionStore((s) => s.mode)
  const connection = useSyncStore((s) => s.connection)
  const sync = useSyncStore((s) => s.sync)
  const { label, detail, icon: Icon, tone } = model(mode, connection, sync?.pending ?? 0, sync?.failed ?? 0, sync?.state === 'syncing')
  return (
    <a
      href={hashFor('profile')}
      title={`${label} — ${detail}`}
      className="flex items-center justify-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-text/5 lg:justify-start lg:px-3"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          tone === 'ok' && 'bg-success/14 text-success',
          tone === 'warn' && 'bg-warning/14 text-warning',
          tone === 'muted' && 'bg-text/6 text-text-muted',
        )}
      >
        <Icon className={cn('size-[1.1rem]', Icon === LoaderCircle && 'animate-spin motion-reduce:animate-none')} />
      </span>
      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-sm font-semibold text-text">{label}</span>
        <span className="block truncate text-xs text-text-muted">{detail}</span>
      </span>
      <span className="sr-only lg:hidden">{`${label}. ${detail}`}</span>
    </a>
  )
}
