import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { ScreenHeader } from '@/app/ScreenHeader'
import { Button, ErrorState, LoadingState, Skeleton } from '@/components/ui'
import { compareDateKeys } from '@/domain/dates'
import { mealTypeForTime } from '@/domain/meals'
import { useToday } from '@/hooks/useToday'
import { formatLongDate } from '@/lib/format'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore } from '@/stores/mealsStore'
import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'
import { AddFoodSheet } from './add-food/AddFoodSheet'
import { DaySwitcher } from './components/DaySwitcher'
import { EditEntrySheet } from './components/EditEntrySheet'
import { MealsContent } from './components/MealsContent'
import { SaveMealSheet } from './components/SaveMealSheet'
import { useMealsDay } from './hooks/useMealsDay'
import { useMealsSheets } from './hooks/useMealsSheets'
import { RecommendationsSection } from './recommendations/RecommendationsSection'
import { removeEntry } from './services/mealActions'

/** Meals tab: the selected day's nutrition, its four meals, and logging food. */
export function MealsScreen() {
  const today = useToday()
  const selected = useMealsStore((s) => s.selectedDate)
  // Never show a future day, even when "today" moved on while a later date was kept.
  const date = selected !== null && compareDateKeys(selected, today) < 0 ? selected : today
  const day = useMealsDay(date)
  const sheets = useMealsSheets()

  // The session loads shared data; load here too when this screen is the first to need it.
  useEffect(() => {
    if (useProfileStore.getState().status === 'idle') void useProfileStore.getState().load()
    if (useWeightStore.getState().status === 'idle') void useWeightStore.getState().load()
    void useFoodLibraryStore.getState().load()
  }, [])

  return (
    <>
      <ScreenHeader
        eyebrow={formatLongDate(date)}
        title="Meals"
        actions={
          <Button size="sm" leadingIcon={<Plus />} onClick={() => sheets.openAddFood(mealTypeForTime(new Date()))}>
            Add food
          </Button>
        }
      >
        <DaySwitcher date={date} today={today} />
      </ScreenHeader>
      <div className="space-y-4 px-5 pb-6 pt-1">
        {day.status === 'error' ? (
          <ErrorState
            title="Couldn't load this day's meals"
            description={`${day.error ?? ''} Your data is safe.`.trim()}
            onRetry={day.retry}
          />
        ) : day.status === 'ready' ? (
          <MealsContent
            day={day}
            today={today}
            sheets={sheets}
            recommendations={<RecommendationsSection date={date} entries={day.entries} targets={day.targets} />}
          />
        ) : (
          <div aria-busy="true" className="space-y-4">
            <LoadingState label="Loading your meals…" className="py-6" />
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
          </div>
        )}
      </div>
      <AddFoodSheet
        key={`add-${sheets.addFood.key}`}
        open={sheets.addFood.open}
        onOpenChange={sheets.setAddFoodOpen}
        date={date}
        today={today}
        initialMealType={sheets.addFood.mealType}
        initialTab={sheets.addFood.tab}
      />
      {sheets.edit.entry ? (
        <EditEntrySheet
          key={`edit-${sheets.edit.key}`}
          entry={sheets.edit.entry}
          open={sheets.edit.open}
          onOpenChange={sheets.setEditOpen}
          onDelete={(entry) => void removeEntry(entry)}
        />
      ) : null}
      <SaveMealSheet
        key={`save-${sheets.saveMeal.key}`}
        mealType={sheets.saveMeal.mealType}
        entries={sheets.saveMeal.entries}
        open={sheets.saveMeal.open}
        onOpenChange={sheets.setSaveMealOpen}
      />
    </>
  )
}
