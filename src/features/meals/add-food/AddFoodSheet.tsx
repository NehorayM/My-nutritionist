import { useEffect, useId, useRef, useState } from 'react'
import { Button, Field, Select, Sheet, Tab, TabList, TabPanel, Tabs } from '@/components/ui'
import type { DateKey } from '@/domain/dates'
import { mealLabel } from '@/domain/meals'
import { formatDateLabel } from '@/lib/format'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore } from '@/stores/mealsStore'
import type { FoodItem, FoodPortion, MealType } from '@/types'
import { ADD_FOOD_TABS, ADD_FOOD_TAB_LABELS, isAddFoodTab, type AddFoodTab, type FoodSelection } from '../model/addFood'
import { inSentence, MEAL_OPTIONS } from '../model/labels'
import { logPortions } from '../services/mealActions'
import { CustomTab } from './CustomTab'
import { FavoritesTab } from './FavoritesTab'
import { FoodDetail } from './FoodDetail'
import { RecentTab } from './RecentTab'
import { SavedMealsTab } from './SavedMealsTab'
import { SearchTab } from './SearchTab'

interface AddFoodSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: DateKey
  today: DateKey
  initialMealType: MealType
  initialTab: AddFoodTab
}

/** Find a food (search, recent, favorites, saved meals, custom), pick an amount and log it to a meal. */
export function AddFoodSheet({ open, onOpenChange, date, today, initialMealType, initialTab }: AddFoodSheetProps) {
  const [tab, setTab] = useState<AddFoodTab>(initialTab)
  const [query, setQuery] = useState('')
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [selection, setSelection] = useState<FoodSelection | null>(null)
  const [selectionKey, setSelectionKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const detailFormId = useId()
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    void useMealsStore.getState().loadRecent()
    void useFoodLibraryStore.getState().load()
  }, [open])

  function select(food: FoodItem, portion: FoodPortion | null = null) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelection({ food, portion })
    setSelectionKey((key) => key + 1)
  }

  function back() {
    setSelection(null)
    const target = returnFocus.current
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus()
    })
  }

  async function logSelection(portion: FoodPortion) {
    setSaving(true)
    const ok = await logPortions([portion], mealType, date)
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add food"
      description={`Logging for ${inSentence(formatDateLabel(date, today))}`}
      size="lg"
      // A steady height while switching tabs and results (and room above the on-screen keyboard).
      className="h-[92dvh] sm:h-[min(88dvh,44rem)]"
      footer={
        selection ? (
          <>
            <Button variant="secondary" onClick={back}>
              Back
            </Button>
            <Button type="submit" form={detailFormId} loading={saving}>
              Add to {mealLabel(mealType)}
            </Button>
          </>
        ) : undefined
      }
    >
      <div hidden={selection !== null}>
        <Field label="Add to" className="mb-3 flex-row items-center gap-3">
          <Select<MealType> value={mealType} onValueChange={setMealType} options={MEAL_OPTIONS} className="min-w-0 flex-1" />
        </Field>
        <Tabs value={tab} onValueChange={(value) => isAddFoodTab(value) && setTab(value)}>
          <TabList label="Find food" className="-mx-5 px-3">
            {ADD_FOOD_TABS.map((value) => (
              <Tab key={value} value={value}>
                {ADD_FOOD_TAB_LABELS[value]}
              </Tab>
            ))}
          </TabList>
          <TabPanel value="search" keepMounted className="pt-4">
            <SearchTab query={query} onQueryChange={setQuery} onSelect={select} onCreateCustom={() => setTab('custom')} />
          </TabPanel>
          <TabPanel value="recent" className="pt-3">
            <RecentTab mealType={mealType} date={date} onSelect={select} />
          </TabPanel>
          <TabPanel value="favorites" className="pt-3">
            <FavoritesTab onSelect={select} />
          </TabPanel>
          <TabPanel value="saved" className="pt-4">
            <SavedMealsTab mealType={mealType} date={date} onLogged={() => onOpenChange(false)} />
          </TabPanel>
          <TabPanel value="custom" keepMounted className="pt-4">
            <CustomTab onCreated={select} onSelect={select} />
          </TabPanel>
        </Tabs>
      </div>
      {selection ? (
        <FoodDetail
          key={selectionKey}
          selection={selection}
          formId={detailFormId}
          mealType={mealType}
          onMealChange={setMealType}
          onSubmit={(portion) => void logSelection(portion)}
        />
      ) : null}
    </Sheet>
  )
}
