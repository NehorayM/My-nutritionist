# Product specification — My-nutritionist

## Purpose
Help people log what they actually eat, understand today's nutrition, and adapt the rest of the day to what
already happened — plus track weight history and weekly activity against their own plan. The app adapts to real
behavior; it never punishes deviations.

Core questions it answers:
- "What makes sense for me to eat next, based on what I already ate today?"
- "How can I make the rest of today more nutritionally balanced with foods that are practical for me?"

## Safety & tone
Wellness assistant, not medical advice. No diagnoses, no extreme restriction, no exercise-as-compensation, food is
never "earned". Neutral vocabulary: *current intake, remaining nutrition, nutritional gap, daily balance, practical
next meal, adaptive recommendation*. Minors (<18 from birth date) receive general wellness targets only — no calorie
deficit/surplus and no weight trajectory. Weight goals use gentle/moderate paces with capped rates and calorie floors.
Estimated calorie burn is informational only and never changes food targets.

## Navigation (bottom bar, 4 tabs)
1. **Meals** (home, current day) 2. **Progress** (weight) 3. **Activity** (weekly plan) 4. **Profile**

## Meals
- Day header with date switcher (today ± history), calorie ring and macro bars (protein, carbs, fat, fiber), and
  **Micronutrient coverage** (iron, calcium, vitamin C, vitamin D, potassium) with transparent missing-data notes.
- Meal cards: Breakfast, Lunch, Dinner, Snacks — foods with grams/serving, calories and macros per item, meal totals,
  expandable details (fiber + available micronutrients), add / edit / delete, empty state with quick actions.
- **Add Food sheet**: debounced search (local catalog instantly; Open Food Facts and USDA when available), results
  list with source badge, food detail with nutrition per 100 g and per portion, grams or serving unit + quantity,
  meal selector, save. Tabs for Recent, Favorites, Saved meals, and **Create custom food**. Loading, empty,
  validation, provider-error and offline states.
- Extras: favorite toggle, copy a meal from yesterday, undo after delete.
- **Smart options for the rest of today** (Adaptive Nutrition Engine): cards per style (Balanced, High protein,
  Quick, No-cook, Mediterranean, Budget, Light) showing foods + portions, kcal, protein, key micronutrients, prep time
  and a one-line explanation. Actions: **Log** (to suggested meal), **Add to another meal**, **Save** (as meal template),
  **Dismiss**, **Show another option**. Recomputed after every log change from persisted state.

## Progress
Quick morning weigh-in, history list (edit/delete), goal configuration (target weight + pace, adults only), chart
(7 days / 30 days / all time) with weigh-ins, 7-day moving-average trend and — only for a safe configured goal — a
target trajectory. Stats: current, weekly change, total change, distance to goal, trend direction. Neutral copy.
Accessible table alternative for the chart.

## Activity
Weekly plan from Profile (strength & cardio sessions/week). Log workouts (type, date, duration, intensity, optional
kcal, notes) with MET-based informational estimate. Weekly progress per category, days remaining, adherence to the
user's own plan. **Smart Catch-Up**: deterministic suggestions that respect recovery spacing and never stack intense
sessions; actions Accept & Schedule, Complete, Dismiss, View another option. Scheduled sessions list.

## Profile
Authentication (sign up / in / out, password reset) when Supabase is configured; Guest mode always available.
**Personal Profile** (name, birth date, sex, height, current & target weight, activity level, goal & pace),
diet settings (diet type, allergies, dislikes, cuisines, prep time, cooking skill), activity settings, units
(metric/imperial, week start), in-app reminders, theme. Connection status ("Connected to Supabase" /
"Running in Offline/Local Mode", pending synchronization count, failed items with retry/discard), guest data import
after sign-in, "How targets are calculated" explanation, data export (JSON) and local data reset.

## Design system
Warm, calm consumer feel — not a dashboard. Oat/cream surfaces, evergreen primary, apricot energy accent, distinct
macro hues (protein indigo, carbs amber, fat rose, fiber green). Plus Jakarta Sans (self-hosted), tabular numerals.
Rounded cards (20–24 px), pill buttons, 44 px minimum touch targets, visible focus rings, light/dark themes,
`prefers-reduced-motion` respected. Mobile: full-width with persistent bottom nav and bottom sheets. Desktop: centered
app column (max ≈ 30 rem) with framed container. Blur only on the bottom bar (solid fallback).
