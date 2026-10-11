import type { FoodItem, KitchenEquipment, MealConstraint, MealType, PantryItem, PantryPrep, PlannerSettings } from '@/types'
import { pantryItemSchema, plannerSettingsSchema } from '@/schemas'
import { asRow, numeric, parseMapped } from './shared'

/** `public.pantry_items` row (005_kitchen_and_reminders.sql); `food` is a jsonb snapshot of the domain food. */
export interface PantryItemRow {
  id: string
  user_id: string
  food: FoodItem
  grams: number | null
  serving_label: string | null
  serving_grams: number | null
  prep: PantryPrep
  cook_minutes: number | null
  methods: KitchenEquipment[]
  use_by: string | null
  created_at: string
  updated_at: string
}

export function pantryItemToRow(item: PantryItem): PantryItemRow {
  return {
    id: item.id,
    user_id: item.userId,
    food: item.food,
    grams: item.grams,
    serving_label: item.servingLabel,
    serving_grams: item.servingGrams,
    prep: item.prep,
    cook_minutes: item.cookMinutes,
    methods: item.methods,
    use_by: item.useBy,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

export function pantryItemFromRow(value: unknown): PantryItem | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(pantryItemSchema, {
    id: row.id,
    userId: row.user_id,
    food: row.food,
    grams: numeric(row.grams),
    servingLabel: row.serving_label,
    servingGrams: numeric(row.serving_grams),
    prep: row.prep,
    cookMinutes: row.cook_minutes,
    methods: row.methods,
    useBy: row.use_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/** `public.planner_settings` row; `id` is the owner (auth.users.id), `meals` a jsonb map of `MealConstraint`s. */
export interface PlannerSettingsRow {
  id: string
  equipment_scope: 'day' | 'meal'
  day_equipment: KitchenEquipment[]
  daily_kcal_min: number | null
  daily_kcal_max: number | null
  meals: Record<MealType, MealConstraint>
  created_at: string
  updated_at: string
}

export function plannerSettingsToRow(settings: PlannerSettings): PlannerSettingsRow {
  return {
    id: settings.userId,
    equipment_scope: settings.equipmentScope,
    day_equipment: settings.dayEquipment,
    daily_kcal_min: settings.dailyKcalMin,
    daily_kcal_max: settings.dailyKcalMax,
    meals: settings.meals,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
  }
}

export function plannerSettingsFromRow(value: unknown): PlannerSettings | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(plannerSettingsSchema, {
    userId: row.id,
    equipmentScope: row.equipment_scope,
    dayEquipment: row.day_equipment,
    dailyKcalMin: row.daily_kcal_min,
    dailyKcalMax: row.daily_kcal_max,
    meals: row.meals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
