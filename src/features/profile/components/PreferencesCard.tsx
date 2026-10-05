import { SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SegmentedControl, Switch } from '@/components/ui'
import { notify } from '@/lib/notify'
import { useProfileStore } from '@/stores/profileStore'
import { useUiStore } from '@/stores/uiStore'
import type { Profile } from '@/types'

type ThemePreference = 'system' | 'light' | 'dark'

/** Settings that apply immediately (no Save button). */
export function PreferencesCard({ profile }: { profile: Profile }) {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  async function patch(changes: Partial<Profile>): Promise<void> {
    const result = await useProfileStore.getState().save({ ...profile, ...changes })
    if (!result.ok) notify.error(result.message)
  }

  return (
    <Card as="section" aria-labelledby="preferences-title">
      <CardHeader>
        <CardTitle as="h2" id="preferences-title">
          <SlidersHorizontal aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          Units & app
        </CardTitle>
        <CardDescription>Changes apply right away.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <SegmentedControl
          label="Units"
          fullWidth
          value={profile.unitSystem}
          onValueChange={(unitSystem) => void patch({ unitSystem })}
          options={[
            { value: 'metric', label: 'Metric (kg, cm)' },
            { value: 'imperial', label: 'Imperial (lb, ft)' },
          ]}
        />
        <SegmentedControl
          label="Week starts on"
          fullWidth
          value={profile.weekStartsOn === 0 ? 'sunday' : 'monday'}
          onValueChange={(day) => void patch({ weekStartsOn: day === 'sunday' ? 0 : 1 })}
          options={[
            { value: 'sunday', label: 'Sunday' },
            { value: 'monday', label: 'Monday' },
          ]}
        />
        <SegmentedControl<ThemePreference>
          label="Appearance"
          fullWidth
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <div className="grid gap-3">
          <Switch
            label="Morning weigh-in reminder"
            description="A gentle note on the Progress tab when you haven't weighed in today."
            checked={profile.reminders.weighIn}
            onCheckedChange={(weighIn) => void patch({ reminders: { ...profile.reminders, weighIn } })}
          />
          <Switch
            label="Weekly activity reminder"
            description="A note on the Activity tab while planned sessions remain this week."
            checked={profile.reminders.activity}
            onCheckedChange={(activity) => void patch({ reminders: { ...profile.reminders, activity } })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
