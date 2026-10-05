import type { Tone } from '@/components/ui'
import type { SyncStatus } from '@/services/sync'
import type { AppMode, ConnectionState } from '@/types'

export interface ConnectionSummary {
  title: string
  description: string
  tone: Tone
}

/**
 * Status line for the Profile screen. "Connected to Supabase" is shown ONLY when signed in and a real
 * request to Supabase just succeeded (connectivity state 'connected').
 */
export function connectionSummary(input: {
  mode: AppMode | null
  connection: ConnectionState
  sync: SyncStatus | null
  authAvailable: boolean
}): ConnectionSummary {
  const { mode, connection, sync, authAvailable } = input
  if (mode !== 'cloud') {
    return {
      title: 'Running in Offline/Local Mode',
      description: authAvailable
        ? 'Your data is stored only on this device. Sign in to back it up and use it on other devices.'
        : 'Your data is stored only on this device. Cloud sync is not set up for this app.',
      tone: 'neutral',
    }
  }
  if (connection === 'connected') {
    const failed = sync && sync.failed > 0 ? ` ${sync.failed} change${sync.failed === 1 ? '' : 's'} need attention.` : ''
    return { title: 'Connected to Supabase', description: `Your data is backed up to your account.${failed}`, tone: failed ? 'warning' : 'success' }
  }
  if (connection === 'checking') {
    return { title: 'Checking connection…', description: 'Changes are saved on this device meanwhile.', tone: 'neutral' }
  }
  return {
    title: 'Offline — saving on this device',
    description: "Changes will sync automatically when the connection to Supabase returns.",
    tone: 'warning',
  }
}

export function pendingText(sync: SyncStatus | null): string | null {
  if (!sync || sync.pending === 0) return null
  return `Pending synchronization: ${sync.pending}`
}
