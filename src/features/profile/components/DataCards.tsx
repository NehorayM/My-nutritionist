import { Download, HardDriveUpload, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ConfirmDialog } from '@/components/ui'
import { todayKey } from '@/domain/dates'
import { notify } from '@/lib/notify'
import { clearUserData } from '@/repositories/local/userData'
import { getRepositories } from '@/services/runtime'
import { session } from '@/services/session'
import { loadSharedData } from '@/services/session/sharedData'
import { resetUserStores } from '@/stores/registry'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { collectExport, downloadJson } from '../lib/exportData'

/** Offer to import guest-mode data into the signed-in account. */
export function GuestImportCard() {
  const offer = useSyncStore((s) => s.guestImport)
  const importing = useSyncStore((s) => s.importing)
  if (!offer) return null

  async function importNow(): Promise<void> {
    const result = await session().importGuestData()
    if (result.ok) notify.success(`Imported ${result.imported ?? 0} items into your account`)
    else notify.error(result.message)
  }

  return (
    <Card as="section" variant="tinted" aria-labelledby="guest-import-title">
      <CardHeader>
        <CardTitle as="h2" id="guest-import-title">
          <HardDriveUpload aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          {offer.total} item{offer.total === 1 ? '' : 's'} from guest mode
        </CardTitle>
        <CardDescription>
          Meals, weigh-ins, workouts and foods you logged before signing in are still on this device. Import them into your
          account — your existing account profile is kept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button loading={importing} onClick={() => void importNow()}>
          Import into my account
        </Button>
      </CardContent>
    </Card>
  )
}

/** Export everything as JSON; in guest mode, also clear this device's data. */
export function DataCard() {
  const mode = useSessionStore((s) => s.mode)
  const userId = useSessionStore((s) => s.userId)
  const [exporting, setExporting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function exportData(): Promise<void> {
    setExporting(true)
    try {
      const data = await collectExport(getRepositories(), new Date())
      downloadJson(data, `my-nutritionist-export-${todayKey()}.json`)
    } catch {
      notify.error("Couldn't prepare the export. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  async function clearDevice(): Promise<void> {
    if (!userId) return
    await clearUserData(userId)
    resetUserStores()
    loadSharedData()
    notify.success('Data on this device was cleared')
  }

  return (
    <Card as="section" aria-labelledby="data-title">
      <CardHeader>
        <CardTitle as="h2" id="data-title">Your data</CardTitle>
        <CardDescription>Download a copy of everything you've logged.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={exporting} leadingIcon={<Download aria-hidden="true" className="size-4" />} onClick={() => void exportData()}>
          Export as JSON
        </Button>
        {mode === 'guest' ? (
          <Button variant="ghost" leadingIcon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => setConfirmClear(true)}>
            Clear data on this device
          </Button>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all data on this device?"
        description="Your profile, meals, weigh-ins, workouts and foods stored in guest mode will be permanently removed. Consider exporting first."
        confirmLabel="Clear data"
        tone="danger"
        onConfirm={clearDevice}
      />
    </Card>
  )
}

export function AboutCard() {
  return (
    <section aria-labelledby="about-title" className="grid gap-2 px-1 pb-4 text-xs text-text-muted">
      <h2 id="about-title" className="text-sm font-semibold text-text">About</h2>
      <p>
        My-nutritionist is a wellness assistant. Its targets and suggestions are general estimates, not medical advice or a
        diagnosis. For personal medical or dietary guidance, please talk to a doctor or registered dietitian.
      </p>
      <p>
        Food data: USDA FoodData Central (public domain) and Open Food Facts (Open Database License, ODbL). Activity
        estimates use the 2024 Adult Compendium of Physical Activities and are informational only.
      </p>
    </section>
  )
}
