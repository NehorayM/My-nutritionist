import { Salad } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, NumberInput, Select, ToggleChip } from '@/components/ui'
import { LIMITS } from '@/schemas'
import { ALLERGENS, COOKING_SKILLS, CUISINES, DIET_TYPES, type Allergen, type CookingSkill, type Cuisine, type DietType, type Profile } from '@/types'
import { useProfileSection } from '../hooks/useProfileSection'
import { ALLERGEN_LABELS, COOKING_SKILL_LABELS, CUISINE_LABELS, DIET_LABELS } from '../lib/labels'
import { DislikesInput } from './DislikesInput'

interface Draft {
  dietType: DietType
  allergies: Allergen[]
  dislikes: string[]
  preferredCuisines: Cuisine[]
  maxPrepMinutes: number | null
  cookingSkill: CookingSkill
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function DietSettingsForm({ profile }: { profile: Profile }) {
  const section = useProfileSection<Draft>({
    profile,
    toDraft: (p) => ({
      dietType: p.dietType,
      allergies: p.allergies,
      dislikes: p.dislikes,
      preferredCuisines: p.preferredCuisines,
      maxPrepMinutes: p.maxPrepMinutes,
      cookingSkill: p.cookingSkill,
    }),
    apply: (p, d) => ({ ...p, ...d, maxPrepMinutes: d.maxPrepMinutes ?? p.maxPrepMinutes }),
    validate: (d) => ({
      maxPrepMinutes:
        d.maxPrepMinutes === null || d.maxPrepMinutes < LIMITS.maxPrepMinutes.min || d.maxPrepMinutes > LIMITS.maxPrepMinutes.max
          ? `Choose between ${LIMITS.maxPrepMinutes.min} and ${LIMITS.maxPrepMinutes.max} minutes.`
          : undefined,
    }),
    successMessage: 'Food preferences saved',
  })
  const { draft, update, errors } = section

  return (
    <Card as="section" aria-labelledby="diet-settings-title">
      <CardHeader>
        <CardTitle as="h2" id="diet-settings-title">
          <Salad aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          Food preferences
        </CardTitle>
        <CardDescription>Shapes your suggestions. Diet patterns are preferences, not medical advice.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void section.save()
          }}
        >
          <Field label="Eating pattern" hint={DIET_LABELS[draft.dietType].hint}>
            <Select value={draft.dietType} onValueChange={(v) => update('dietType', v)} options={DIET_TYPES.map((d) => ({ value: d, label: DIET_LABELS[d].label }))} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold text-text">Allergies</legend>
            <p className="-mt-1 text-xs text-text-muted">Foods with these allergens — or without allergen information — are left out of suggestions.</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((allergen) => (
                <ToggleChip key={allergen} pressed={draft.allergies.includes(allergen)} onPressedChange={() => update('allergies', toggle(draft.allergies, allergen))}>
                  {ALLERGEN_LABELS[allergen]}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
          <DislikesInput value={draft.dislikes} onChange={(dislikes) => update('dislikes', dislikes)} />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold text-text">Cuisines you enjoy</legend>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((cuisine) => (
                <ToggleChip
                  key={cuisine}
                  pressed={draft.preferredCuisines.includes(cuisine)}
                  onPressedChange={() => update('preferredCuisines', toggle(draft.preferredCuisines, cuisine))}
                >
                  {CUISINE_LABELS[cuisine]}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred prep time" error={errors.maxPrepMinutes} hint="Per meal, at most.">
              <NumberInput value={draft.maxPrepMinutes} unit="min" onValueChange={(v) => update('maxPrepMinutes', v)} />
            </Field>
            <Field label="Cooking">
              <Select value={draft.cookingSkill} onValueChange={(v) => update('cookingSkill', v)} options={COOKING_SKILLS.map((c) => ({ value: c, label: COOKING_SKILL_LABELS[c] }))} />
            </Field>
          </div>
          {section.failure ? <p role="alert" className="text-sm font-semibold text-danger">{section.failure}</p> : null}
          <Button type="submit" loading={section.saving} disabled={!section.dirty} className="justify-self-start">
            Save food preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
