import { useMemo, useState } from 'react'
import type { MealEntry, MealType } from '@/types'
import type { AddFoodTab } from '../model/addFood'

interface SheetSlot {
  open: boolean
  /** Bumped on every open so the sheet starts fresh, while a closing sheet keeps its content. */
  key: number
}

export interface MealsSheets {
  addFood: SheetSlot & { mealType: MealType; tab: AddFoodTab }
  edit: SheetSlot & { entry: MealEntry | null }
  saveMeal: SheetSlot & { mealType: MealType; entries: readonly MealEntry[] }
  openAddFood: (mealType: MealType, tab?: AddFoodTab) => void
  openEdit: (entry: MealEntry) => void
  openSaveMeal: (mealType: MealType, entries: readonly MealEntry[]) => void
  setAddFoodOpen: (open: boolean) => void
  setEditOpen: (open: boolean) => void
  setSaveMealOpen: (open: boolean) => void
}

/** Open/close state of the Meals tab's sheets (add food, edit entry, save as meal). */
export function useMealsSheets(): MealsSheets {
  const [addFood, setAddFood] = useState<MealsSheets['addFood']>({ open: false, key: 0, mealType: 'breakfast', tab: 'search' })
  const [edit, setEdit] = useState<MealsSheets['edit']>({ open: false, key: 0, entry: null })
  const [saveMeal, setSaveMeal] = useState<MealsSheets['saveMeal']>({ open: false, key: 0, mealType: 'breakfast', entries: [] })

  const actions = useMemo(
    () => ({
      openAddFood: (mealType: MealType, tab: AddFoodTab = 'search') =>
        setAddFood((slot) => ({ open: true, key: slot.key + 1, mealType, tab })),
      openEdit: (entry: MealEntry) => setEdit((slot) => ({ open: true, key: slot.key + 1, entry })),
      openSaveMeal: (mealType: MealType, entries: readonly MealEntry[]) =>
        setSaveMeal((slot) => ({ open: true, key: slot.key + 1, mealType, entries })),
      setAddFoodOpen: (open: boolean) => setAddFood((slot) => ({ ...slot, open })),
      setEditOpen: (open: boolean) => setEdit((slot) => ({ ...slot, open })),
      setSaveMealOpen: (open: boolean) => setSaveMeal((slot) => ({ ...slot, open })),
    }),
    [],
  )

  return { addFood, edit, saveMeal, ...actions }
}
