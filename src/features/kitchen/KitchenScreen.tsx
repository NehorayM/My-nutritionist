import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ScreenHeader } from '@/app/ScreenHeader'
import { ScreenBody, ScreenColumns } from '@/app/ScreenLayout'
import { Button, ErrorState, LoadingState, Skeleton } from '@/components/ui'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useKitchenStore } from '@/stores/kitchenStore'
import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'
import type { PantryItem } from '@/types'
import { ConstraintsSummary } from './components/ConstraintsSummary'
import { KitchenSettingsSheet } from './components/KitchenSettingsSheet'
import { PantryItemSheet } from './components/PantryItemSheet'
import { PantrySection } from './components/PantrySection'
import { PlanSection } from './components/PlanSection'
import { useKitchenPlan } from './hooks/useKitchenPlan'
import { removePantryItem } from './services/kitchenActions'

/** Kitchen tab: what's at home, what's possible (equipment, time, calories), and meals planned from both. */
export function KitchenScreen() {
  const status = useKitchenStore((s) => s.status)
  const error = useKitchenStore((s) => s.error)
  const pantry = useKitchenStore((s) => s.pantry)
  const settings = useKitchenStore((s) => s.settings)
  const plan = useKitchenPlan()
  const [itemSheet, setItemSheet] = useState<{ open: boolean; item: PantryItem | null; key: number }>({ open: false, item: null, key: 0 })
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void useKitchenStore.getState().load()
    void useFoodLibraryStore.getState().load()
    if (useProfileStore.getState().status === 'idle') void useProfileStore.getState().load()
    if (useWeightStore.getState().status === 'idle') void useWeightStore.getState().load()
  }, [])

  const openItem = (item: PantryItem | null) => setItemSheet((current) => ({ open: true, item, key: current.key + 1 }))

  return (
    <>
      <ScreenHeader
        title="Kitchen"
        subtitle="Plan meals from what you have at home"
        actions={
          <Button size="sm" leadingIcon={<Plus />} onClick={() => openItem(null)}>
            Add item
          </Button>
        }
      />
      <ScreenBody>
        {status === 'error' ? (
          <ErrorState title="Couldn’t load your kitchen" description={`${error ?? ''} Your data is safe.`.trim()} onRetry={() => void useKitchenStore.getState().load({ force: true })} />
        ) : status !== 'ready' || !settings ? (
          <div aria-busy="true" className="space-y-4">
            <LoadingState label="Loading your kitchen…" className="py-6" />
            <Skeleton className="h-48 rounded-card" />
          </div>
        ) : (
          <ScreenColumns
            main={plan.result ? <PlanSection result={plan.result} today={plan.today} onOtherPlan={plan.nextVariant} /> : null}
            lead={
              <>
                <PantrySection pantry={pantry} today={plan.today} onAdd={() => openItem(null)} onEdit={openItem} onRemove={(item) => void removePantryItem(item.id)} />
                <ConstraintsSummary settings={settings} day={plan.result?.day ?? null} onEdit={() => setSettingsOpen(true)} />
              </>
            }
          />
        )}
      </ScreenBody>
      <PantryItemSheet
        key={`item-${itemSheet.key}`}
        open={itemSheet.open}
        item={itemSheet.item}
        onOpenChange={(open) => setItemSheet((current) => ({ ...current, open }))}
      />
      {settings ? <KitchenSettingsSheet key={`settings-${String(settingsOpen)}`} open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} /> : null}
    </>
  )
}
