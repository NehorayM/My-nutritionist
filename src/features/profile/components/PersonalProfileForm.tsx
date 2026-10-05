import { UserRound } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, NumberInput, Select } from '@/components/ui'
import { isMinor } from '@/domain/profile'
import { useToday } from '@/hooks/useToday'
import { LIMITS, TEXT_LIMITS } from '@/schemas'
import { ACTIVITY_LEVELS, SEXES, type ActivityLevel, type Profile, type Sex } from '@/types'
import { useProfileSection } from '../hooks/useProfileSection'
import {
  heightCmFrom,
  heightInputFrom,
  validHeight,
  validWeight,
  weightInputFrom,
  weightKgFrom,
  weightRangeText,
  type HeightInput,
} from '../lib/bodyInputs'
import { ACTIVITY_LEVEL_LABELS, SEX_LABELS } from '../lib/labels'

interface Draft {
  displayName: string
  birthDate: string
  sex: Sex
  height: HeightInput
  weight: number | null
  activityLevel: ActivityLevel
}

export function PersonalProfileForm({ profile }: { profile: Profile }) {
  const today = useToday()
  const units = profile.unitSystem
  const section = useProfileSection<Draft>({
    profile,
    toDraft: (p) => ({
      displayName: p.displayName,
      birthDate: p.birthDate ?? '',
      sex: p.sex,
      height: heightInputFrom(p.heightCm),
      weight: weightInputFrom(p.currentWeightKg, units),
      activityLevel: p.activityLevel,
    }),
    apply: (p, d) => ({
      ...p,
      displayName: d.displayName.trim(),
      birthDate: d.birthDate || null,
      sex: d.sex,
      heightCm: heightCmFrom(d.height, units),
      currentWeightKg: weightKgFrom(d.weight, units),
      activityLevel: d.activityLevel,
    }),
    validate: (d) => ({
      birthDate:
        d.birthDate && (d.birthDate > today || d.birthDate < LIMITS.birthDate.min) ? 'Enter a birth date in the past.' : undefined,
      height: validHeight(heightCmFrom(d.height, units)) ? undefined : 'Enter a height between 50 and 272 cm (1′8″–8′11″).',
      weight: validWeight(weightKgFrom(d.weight, units)) ? undefined : `Enter a weight between ${weightRangeText(units)}.`,
    }),
    successMessage: 'Personal Profile saved',
  })
  const { draft, update, errors } = section
  const minor = draft.birthDate ? isMinor({ birthDate: draft.birthDate }, today) : false

  return (
    <Card as="section" aria-labelledby="personal-profile-title">
      <CardHeader>
        <CardTitle as="h2" id="personal-profile-title">
          <UserRound aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          Personal Profile
        </CardTitle>
        <CardDescription>Used to estimate your daily targets. Everything here is optional.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void section.save()
          }}
        >
          <Field label="Display name" optional>
            <Input value={draft.displayName} maxLength={TEXT_LIMITS.displayName} autoComplete="nickname" onChange={(e) => update('displayName', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Birth date" optional error={errors.birthDate} hint={minor ? 'Under 18: targets stay general and wellness-focused.' : undefined}>
              <Input type="date" value={draft.birthDate} max={today} min={LIMITS.birthDate.min} onChange={(e) => update('birthDate', e.target.value)} />
            </Field>
            <Field label="Sex" hint="Only used for energy and nutrient estimates.">
              <Select value={draft.sex} onValueChange={(v) => update('sex', v)} options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {units === 'metric' ? (
              <Field label="Height" optional error={errors.height}>
                <NumberInput value={draft.height.cm} unit="cm" onValueChange={(cm) => update('height', { ...draft.height, cm })} />
              </Field>
            ) : (
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="sr-only">Height</legend>
                <Field label="Height (ft)" optional error={errors.height}>
                  <NumberInput value={draft.height.feet} unit="ft" onValueChange={(feet) => update('height', { ...draft.height, feet })} />
                </Field>
                <Field label="Inches">
                  <NumberInput value={draft.height.inches} unit="in" onValueChange={(inches) => update('height', { ...draft.height, inches })} />
                </Field>
              </fieldset>
            )}
            <Field label="Current weight" optional error={errors.weight} hint="Your latest weigh-in is used when you have one.">
              <NumberInput value={draft.weight} unit={units === 'imperial' ? 'lb' : 'kg'} onValueChange={(w) => update('weight', w)} />
            </Field>
          </div>
          <Field label="Everyday activity" hint={ACTIVITY_LEVEL_LABELS[draft.activityLevel].hint}>
            <Select
              value={draft.activityLevel}
              onValueChange={(v) => update('activityLevel', v)}
              options={ACTIVITY_LEVELS.map((a) => ({ value: a, label: ACTIVITY_LEVEL_LABELS[a].label }))}
            />
          </Field>
          {section.failure ? <p role="alert" className="text-sm font-semibold text-danger">{section.failure}</p> : null}
          <Button type="submit" loading={section.saving} disabled={!section.dirty} className="justify-self-start">
            Save Personal Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
