import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import type { Organization } from '@/types/auth'

// Local edits to part of the organization's settings, saved together. The draft
// takes the server's version after saving, since the server tidies some values.
export function useOrgDraft<T>(select: (org: Organization) => T, save: (draft: T) => Promise<Organization>) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const current = user ? select(user.organization) : null
  const [draft, setDraftState] = useState<T | null>(current)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: (value: T) => save(value),
    onSuccess: (org) => {
      if (user && token) setAuth(token, { ...user, organization: org })
      setDraftState(select(org))
      setSaved(true)
    },
  })

  const setDraft = (next: T) => {
    setDraftState(next)
    setSaved(false)
    mutation.reset()
  }

  return {
    draft: draft as T,
    setDraft,
    dirty: JSON.stringify(draft) !== JSON.stringify(current),
    save: () => draft !== null && mutation.mutate(draft),
    discard: () => setDraft(current as T),
    saving: mutation.isPending,
    saved,
    error: mutation.error,
  }
}
