import { useState } from 'react'
import { notify } from '@/lib/notify'
import { useProfileStore } from '@/stores/profileStore'
import type { Profile } from '@/types'

/**
 * Draft state for one Profile section: edit locally, then save the whole profile with the section's
 * fields applied. `validate` returns field errors (empty object = valid).
 */
export function useProfileSection<D>(options: {
  profile: Profile
  toDraft: (profile: Profile) => D
  apply: (profile: Profile, draft: D) => Profile
  validate?: (draft: D) => Partial<Record<keyof D, string>>
  successMessage: string
}) {
  const { profile, toDraft, apply, validate, successMessage } = options
  const [draft, setDraft] = useState<D>(() => toDraft(profile))
  const [errors, setErrors] = useState<Partial<Record<keyof D, string>>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const saving = useProfileStore((s) => s.saving)

  function update<K extends keyof D>(key: K, value: D[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function save(): Promise<boolean> {
    const found = validate?.(draft) ?? {}
    setErrors(found)
    if (Object.values(found).some(Boolean)) return false
    const result = await useProfileStore.getState().save(apply(profile, draft))
    setFailure(result.ok ? null : result.message)
    if (result.ok) notify.success(successMessage)
    return result.ok
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(profile))
  return { draft, update, errors, failure, saving, save, dirty }
}
