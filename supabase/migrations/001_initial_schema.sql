-- My-nutritionist — initial schema.
-- Canonical source of truth for the database structure. Row Level Security lives in 002_rls_policies.sql,
-- system food reference data in 003_seed_foods.sql.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Validates a nutrient snapshot: a JSON object whose values are null (unknown) or non-negative numbers.
create or replace function public.is_valid_nutrient_map(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
      from jsonb_each(value) as entry(key, val)
      where char_length(entry.key) > 40
        or not (
          jsonb_typeof(entry.val) = 'null'
          or (jsonb_typeof(entry.val) = 'number' and (entry.val)::numeric >= 0 and (entry.val)::numeric <= 100000)
        )
    )
    and coalesce((value ->> 'calories')::numeric, 0) <= 1000;
$$;

-- Stale-write guard + timestamp hygiene for synchronized tables.
-- * Clamps client-supplied updated_at that is in the future (clock skew) to now().
-- * On UPDATE, silently skips the write when the incoming row is OLDER than the stored row, so a delayed
--   offline mutation can never overwrite newer data (last writer by updated_at wins, deterministically).
-- * created_at is immutable after insert.
create or replace function public.guard_stale_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is null or new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — Personal Profile (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  birth_date date check (birth_date between date '1900-01-01' and date '2100-01-01'),
  sex text not null default 'unspecified' check (sex in ('female', 'male', 'unspecified')),
  height_cm numeric(5, 1) check (height_cm between 50 and 272),
  current_weight_kg numeric(5, 2) check (current_weight_kg between 20 and 400),
  target_weight_kg numeric(5, 2) check (target_weight_kg between 20 and 400),
  activity_level text not null default 'light'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'general_wellness'
    check (goal in ('general_wellness', 'maintain', 'lose_weight', 'gain_weight', 'build_muscle')),
  goal_pace text not null default 'gentle' check (goal_pace in ('gentle', 'moderate')),
  diet_type text not null default 'balanced'
    check (diet_type in ('balanced', 'high_protein', 'mediterranean', 'keto', 'vegetarian', 'vegan')),
  allergies text[] not null default '{}'
    check (allergies <@ array['milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'gluten', 'soy', 'sesame']::text[]),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 50),
  preferred_cuisines text[] not null default '{}'
    check (preferred_cuisines <@ array['mediterranean', 'israeli', 'middle_eastern', 'american', 'italian', 'asian', 'mexican', 'indian']::text[]),
  max_prep_minutes smallint not null default 30 check (max_prep_minutes between 5 and 240),
  cooking_skill text not null default 'intermediate' check (cooking_skill in ('beginner', 'intermediate', 'confident')),
  strength_sessions_per_week smallint not null default 2 check (strength_sessions_per_week between 0 and 14),
  cardio_sessions_per_week smallint not null default 2 check (cardio_sessions_per_week between 0 and 14),
  preferred_workout_minutes smallint not null default 40 check (preferred_workout_minutes between 10 and 180),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  reminders jsonb not null default '{"weighIn": true, "activity": true}'::jsonb check (jsonb_typeof(reminders) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- food_items — system catalog (created_by IS NULL) + user custom / saved provider foods
-- ---------------------------------------------------------------------------
create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('system', 'usda', 'off', 'custom')),
  external_id text check (char_length(external_id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  category text check (category in ('protein', 'dairy', 'grain', 'legume', 'vegetable', 'fruit', 'fat', 'nut_seed',
    'snack', 'sweet', 'fast_food', 'israeli', 'beverage', 'prepared')),
  nutrients_per_100g jsonb not null check (public.is_valid_nutrient_map(nutrients_per_100g)),
  servings jsonb not null default '[]'::jsonb check (jsonb_typeof(servings) = 'array' and jsonb_array_length(servings) <= 20),
  -- NULL = allergen information unknown
  allergens text[] check (allergens <@ array['milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'gluten', 'soy', 'sesame']::text[]),
  is_vegetarian boolean,
  is_vegan boolean,
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  meal_types text[] not null default '{}' check (cardinality(meal_types) <= 10),
  prep_minutes smallint check (prep_minutes between 0 and 600),
  requires_cooking boolean,
  cost_tier smallint check (cost_tier between 1 and 3),
  attribution text check (char_length(attribution) <= 300),
  created_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_items_owner_matches_source check ((source = 'system') = (created_by is null))
);

create index food_items_created_by_idx on public.food_items (created_by);
create unique index food_items_user_external_key
  on public.food_items (created_by, source, external_id)
  where created_by is not null and external_id is not null;
create unique index food_items_system_external_key
  on public.food_items (external_id)
  where created_by is null;

-- ---------------------------------------------------------------------------
-- meal_logs — what the user actually ate, with an immutable nutrition snapshot
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  -- plain text (no enum) so meal slots can become customizable without a migration
  meal_type text not null check (char_length(meal_type) between 1 and 32),
  food_id uuid references public.food_items (id) on delete set null,
  food_source text not null check (food_source in ('system', 'usda', 'off', 'custom')),
  food_external_id text check (char_length(food_external_id) <= 64),
  food_name text not null check (char_length(food_name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 10000),
  serving_label text check (char_length(serving_label) <= 80),
  serving_grams numeric(10, 3) check (serving_grams > 0 and serving_grams <= 5000),
  grams numeric(10, 3) not null check (grams > 0 and grams <= 10000),
  nutrients_per_100g jsonb not null check (public.is_valid_nutrient_map(nutrients_per_100g)),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_logs_user_date_idx on public.meal_logs (user_id, log_date);
create index meal_logs_user_logged_at_idx on public.meal_logs (user_id, logged_at desc);
create index meal_logs_food_id_idx on public.meal_logs (food_id);

-- ---------------------------------------------------------------------------
-- weight_logs — weigh-ins (canonical kg; multiple per day allowed, not at the same instant)
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  measured_at timestamptz not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  input_unit text not null default 'kg' check (input_unit in ('kg', 'lb')),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_logs_user_instant_key unique (user_id, measured_at)
);

create index weight_logs_user_date_idx on public.weight_logs (user_id, measured_on);

-- ---------------------------------------------------------------------------
-- workout_logs — completed activity
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_date date not null,
  type text not null check (type in ('strength', 'cardio', 'hiit', 'walk', 'run', 'cycling', 'swimming', 'mobility', 'sports', 'other')),
  duration_min smallint not null check (duration_min between 1 and 600),
  intensity text check (intensity in ('light', 'moderate', 'vigorous')),
  estimated_kcal smallint check (estimated_kcal between 0 and 5000),
  kcal_source text check (kcal_source in ('user', 'estimate')),
  notes text check (char_length(notes) <= 500),
  -- plain reference (no FK) to avoid a circular dependency with scheduled_workouts
  scheduled_workout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_logs_user_date_idx on public.workout_logs (user_id, workout_date);

-- ---------------------------------------------------------------------------
-- scheduled_workouts — accepted Smart Catch-Up / planned sessions
-- ---------------------------------------------------------------------------
create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_date date not null,
  type text not null check (type in ('strength', 'cardio', 'hiit', 'walk', 'run', 'cycling', 'swimming', 'mobility', 'sports', 'other')),
  duration_min smallint not null check (duration_min between 1 and 600),
  intensity text check (intensity in ('light', 'moderate', 'vigorous')),
  status text not null default 'planned' check (status in ('planned', 'completed', 'dismissed')),
  source text not null default 'manual' check (source in ('catch_up', 'manual')),
  rationale text check (char_length(rationale) <= 300),
  completed_workout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scheduled_workouts_user_date_idx on public.scheduled_workouts (user_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- favorites — favorite foods (system or the user's own food_items)
-- ---------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.food_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorites_user_food_key unique (user_id, food_id)
);

create index favorites_food_id_idx on public.favorites (food_id);

-- ---------------------------------------------------------------------------
-- saved_meals — meal templates (e.g. saved recommendations)
-- ---------------------------------------------------------------------------
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  meal_type text check (char_length(meal_type) between 1 and 32),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_meals_user_idx on public.saved_meals (user_id);

-- ---------------------------------------------------------------------------
-- Stale-write triggers
-- ---------------------------------------------------------------------------
create trigger profiles_guard_stale_write before insert or update on public.profiles
  for each row execute function public.guard_stale_write();
create trigger food_items_guard_stale_write before insert or update on public.food_items
  for each row execute function public.guard_stale_write();
create trigger meal_logs_guard_stale_write before insert or update on public.meal_logs
  for each row execute function public.guard_stale_write();
create trigger weight_logs_guard_stale_write before insert or update on public.weight_logs
  for each row execute function public.guard_stale_write();
create trigger workout_logs_guard_stale_write before insert or update on public.workout_logs
  for each row execute function public.guard_stale_write();
create trigger scheduled_workouts_guard_stale_write before insert or update on public.scheduled_workouts
  for each row execute function public.guard_stale_write();
create trigger favorites_guard_stale_write before insert or update on public.favorites
  for each row execute function public.guard_stale_write();
create trigger saved_meals_guard_stale_write before insert or update on public.saved_meals
  for each row execute function public.guard_stale_write();
