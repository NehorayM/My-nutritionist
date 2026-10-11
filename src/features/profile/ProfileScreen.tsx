import { ScreenHeader } from '@/app/ScreenHeader'
import { ScreenBody, ScreenColumns } from '@/app/ScreenLayout'
import { ErrorState, LoadingState } from '@/components/ui'
import { useProfileStore } from '@/stores/profileStore'
import { useSessionStore } from '@/stores/sessionStore'
import { AccountCard } from './components/AccountCard'
import { AboutCard, DataCard, GuestImportCard } from './components/DataCards'
import { DietSettingsForm } from './components/DietSettingsForm'
import { PersonalProfileForm } from './components/PersonalProfileForm'
import { ActivityPlanCard, ProfileGoalCard } from './components/PlanAndGoalCards'
import { PreferencesCard } from './components/PreferencesCard'
import { RemindersCard } from './reminders/RemindersCard'
import { TargetsExplainer } from './components/TargetsExplainer'

export function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile)
  const status = useProfileStore((s) => s.status)
  const error = useProfileStore((s) => s.error)
  const persisted = useProfileStore((s) => s.persisted)
  const mode = useSessionStore((s) => s.mode)
  const name = profile?.displayName.trim()

  return (
    <>
      <ScreenHeader
        title="Profile"
        subtitle={name ? `Hi, ${name}` : mode === 'cloud' ? 'Your account, details and preferences' : 'Your details, preferences and data'}
      />
      <ScreenBody>
        <ScreenColumns
          lead={
            <>
              <AccountCard />
              <GuestImportCard />
            </>
          }
          main={
            status === 'error' ? (
              <ErrorState description={error ?? undefined} onRetry={() => void useProfileStore.getState().load()} />
            ) : !profile || status === 'loading' || status === 'idle' ? (
              <LoadingState label="Loading your profile…" />
            ) : (
              // Remount the forms when the stored profile changes (save elsewhere, import, user switch).
              <div key={`${profile.userId}:${profile.updatedAt}`} className="grid gap-5">
                {!persisted ? (
                  <p className="rounded-card bg-primary/8 p-4 text-sm text-text">
                    Add a few details below to personalize your daily targets. Until then, general wellness targets are used.
                  </p>
                ) : null}
                <PersonalProfileForm profile={profile} />
                <ProfileGoalCard />
                <DietSettingsForm profile={profile} />
                <ActivityPlanCard profile={profile} />
                <PreferencesCard profile={profile} />
                <TargetsExplainer />
              </div>
            )
          }
          aside={
            <>
              <RemindersCard />
              <DataCard />
              <AboutCard />
            </>
          }
        />
      </ScreenBody>
    </>
  )
}
