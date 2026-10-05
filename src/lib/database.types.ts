
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "favorites": {
                  Row: {
                    "created_at": string,"food_id": string,"id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"food_id": string,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "food_items"
      referencedColumns: ["id"]
    }
                  ]
                },"food_items": {
                  Row: {
                    "allergens": (string)[] | null,"attribution": string | null,"barcode": string | null,"brand": string | null,"category": string | null,"cost_tier": number | null,"created_at": string,"created_by": string | null,"external_id": string | null,"id": string,"is_vegan": boolean | null,"is_vegetarian": boolean | null,"meal_types": (string)[],"name": string,"nutrients_per_100g": NonNullable<Json>,"prep_minutes": number | null,"requires_cooking": boolean | null,"servings": NonNullable<Json>,"source": string,"tags": (string)[],"updated_at": string
                  }
                  Insert: {
                    "allergens"?: (string)[] | null,"attribution"?: string | null,"barcode"?: string | null,"brand"?: string | null,"category"?: string | null,"cost_tier"?: number | null,"created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"id"?: string,"is_vegan"?: boolean | null,"is_vegetarian"?: boolean | null,"meal_types"?: (string)[],"name": string,"nutrients_per_100g": NonNullable<Json>,"prep_minutes"?: number | null,"requires_cooking"?: boolean | null,"servings"?: NonNullable<Json>,"source": string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "allergens"?: (string)[] | null,"attribution"?: string | null,"barcode"?: string | null,"brand"?: string | null,"category"?: string | null,"cost_tier"?: number | null,"created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"id"?: string,"is_vegan"?: boolean | null,"is_vegetarian"?: boolean | null,"meal_types"?: (string)[],"name"?: string,"nutrients_per_100g"?: NonNullable<Json>,"prep_minutes"?: number | null,"requires_cooking"?: boolean | null,"servings"?: NonNullable<Json>,"source"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_logs": {
                  Row: {
                    "brand": string | null,"created_at": string,"food_external_id": string | null,"food_id": string | null,"food_name": string,"food_source": string,"grams": number,"id": string,"log_date": string,"logged_at": string,"meal_type": string,"nutrients_per_100g": NonNullable<Json>,"quantity": number,"serving_grams": number | null,"serving_label": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "brand"?: string | null,"created_at"?: string,"food_external_id"?: string | null,"food_id"?: string | null,"food_name": string,"food_source": string,"grams": number,"id"?: string,"log_date": string,"logged_at"?: string,"meal_type": string,"nutrients_per_100g": NonNullable<Json>,"quantity": number,"serving_grams"?: number | null,"serving_label"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "brand"?: string | null,"created_at"?: string,"food_external_id"?: string | null,"food_id"?: string | null,"food_name"?: string,"food_source"?: string,"grams"?: number,"id"?: string,"log_date"?: string,"logged_at"?: string,"meal_type"?: string,"nutrients_per_100g"?: NonNullable<Json>,"quantity"?: number,"serving_grams"?: number | null,"serving_label"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_logs_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "food_items"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "activity_level": string,"allergies": (string)[],"birth_date": string | null,"cardio_sessions_per_week": number,"cooking_skill": string,"created_at": string,"current_weight_kg": number | null,"diet_type": string,"dislikes": (string)[],"display_name": string,"goal": string,"goal_pace": string,"height_cm": number | null,"id": string,"max_prep_minutes": number,"preferred_cuisines": (string)[],"preferred_workout_minutes": number,"reminders": NonNullable<Json>,"sex": string,"strength_sessions_per_week": number,"target_weight_kg": number | null,"unit_system": string,"updated_at": string,"week_starts_on": number
                  }
                  Insert: {
                    "activity_level"?: string,"allergies"?: (string)[],"birth_date"?: string | null,"cardio_sessions_per_week"?: number,"cooking_skill"?: string,"created_at"?: string,"current_weight_kg"?: number | null,"diet_type"?: string,"dislikes"?: (string)[],"display_name"?: string,"goal"?: string,"goal_pace"?: string,"height_cm"?: number | null,"id": string,"max_prep_minutes"?: number,"preferred_cuisines"?: (string)[],"preferred_workout_minutes"?: number,"reminders"?: NonNullable<Json>,"sex"?: string,"strength_sessions_per_week"?: number,"target_weight_kg"?: number | null,"unit_system"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "activity_level"?: string,"allergies"?: (string)[],"birth_date"?: string | null,"cardio_sessions_per_week"?: number,"cooking_skill"?: string,"created_at"?: string,"current_weight_kg"?: number | null,"diet_type"?: string,"dislikes"?: (string)[],"display_name"?: string,"goal"?: string,"goal_pace"?: string,"height_cm"?: number | null,"id"?: string,"max_prep_minutes"?: number,"preferred_cuisines"?: (string)[],"preferred_workout_minutes"?: number,"reminders"?: NonNullable<Json>,"sex"?: string,"strength_sessions_per_week"?: number,"target_weight_kg"?: number | null,"unit_system"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    
                  ]
                },"saved_meals": {
                  Row: {
                    "created_at": string,"id": string,"items": NonNullable<Json>,"meal_type": string | null,"name": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"items": NonNullable<Json>,"meal_type"?: string | null,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"meal_type"?: string | null,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scheduled_workouts": {
                  Row: {
                    "completed_workout_id": string | null,"created_at": string,"duration_min": number,"id": string,"intensity": string | null,"rationale": string | null,"scheduled_date": string,"source": string,"status": string,"type": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "completed_workout_id"?: string | null,"created_at"?: string,"duration_min": number,"id"?: string,"intensity"?: string | null,"rationale"?: string | null,"scheduled_date": string,"source"?: string,"status"?: string,"type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_workout_id"?: string | null,"created_at"?: string,"duration_min"?: number,"id"?: string,"intensity"?: string | null,"rationale"?: string | null,"scheduled_date"?: string,"source"?: string,"status"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weight_logs": {
                  Row: {
                    "created_at": string,"id": string,"input_unit": string,"measured_at": string,"measured_on": string,"note": string | null,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"input_unit"?: string,"measured_at": string,"measured_on": string,"note"?: string | null,"updated_at"?: string,"user_id": string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"input_unit"?: string,"measured_at"?: string,"measured_on"?: string,"note"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"workout_logs": {
                  Row: {
                    "created_at": string,"duration_min": number,"estimated_kcal": number | null,"id": string,"intensity": string | null,"kcal_source": string | null,"notes": string | null,"scheduled_workout_id": string | null,"type": string,"updated_at": string,"user_id": string,"workout_date": string
                  }
                  Insert: {
                    "created_at"?: string,"duration_min": number,"estimated_kcal"?: number | null,"id"?: string,"intensity"?: string | null,"kcal_source"?: string | null,"notes"?: string | null,"scheduled_workout_id"?: string | null,"type": string,"updated_at"?: string,"user_id": string,"workout_date": string
                  }
                  Update: {
                    "created_at"?: string,"duration_min"?: number,"estimated_kcal"?: number | null,"id"?: string,"intensity"?: string | null,"kcal_source"?: string | null,"notes"?: string | null,"scheduled_workout_id"?: string | null,"type"?: string,"updated_at"?: string,"user_id"?: string,"workout_date"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_valid_nutrient_map":
{ Args: { "value": Json }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
