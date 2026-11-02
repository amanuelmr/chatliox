import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assignConversation } from '@/api/conversations'
import { getTeammates } from '@/api/organizations'
import { apiErrorMessage } from '@/lib/apiError'
import { useAuthStore } from '@/store/authStore'
import type { Conversation } from '@/types/chat'

// The "Assigned to …" control in the chat header: take, hand over or release a chat.
export default function AssignMenu({ conversation }: { conversation: Conversation }) {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const [open, setOpen] = useState(false)
  // undefined: picking a teammate; null: unassigning; a string: handing to that teammate.
  const [choice, setChoice] = useState<string | null | undefined>(undefined)
  const [note, setNote] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const { data: teammates = [] } = useQuery({
    queryKey: ['teammates'],
    queryFn: getTeammates,
    enabled: open,
    staleTime: 60_000,
  })
  // You first, then everyone else alphabetically (the API's order).
  const ordered = [...teammates].sort((a, b) => Number(b.id === userId) - Number(a.id === userId))

  const close = () => { setOpen(false); setChoice(undefined); setNote('') }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { mutate: assign, isPending, error, reset } = useMutation({
    mutationFn: () => assignConversation(conversation.id, choice ?? null, note.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (convs = []) =>
        convs.map((c) => (c.id === updated.id ? updated : c)),
      )
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
      close()
    },
  })

  const pick = (id: string | null) => { reset(); setChoice(id) }
  const label = conversation.assigned_to_id === null
    ? 'Unassigned'
    : conversation.assigned_to_id === userId
      ? 'Assigned to you'
      : `Assigned to ${conversation.assigned_to_name}`
  const chosenName = choice === userId ? 'yourself' : teammates.find((t) => t.id === choice)?.full_name

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <span className={conversation.assigned_to_id ? 'text-brand-600 font-medium' : ''}>{label}</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1.5 z-20 w-64 bg-white text-zinc-700 rounded-xl shadow-lg ring-1 ring-zinc-200 p-1.5">
          {choice === undefined ? (
            <>
              <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Assign to</p>
              {ordered.map((t) => {
                const current = t.id === conversation.assigned_to_id
                return (
                  <button
                    key={t.id}
                    role="menuitem"
                    disabled={current}
                    onClick={() => pick(t.id)}
                    className="w-full flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 disabled:hover:bg-transparent disabled:text-zinc-400"
                  >
                    <span className="truncate">{t.id === userId ? `Me (${t.full_name})` : t.full_name}</span>
                    {current && <span className="text-[11px]">Current</span>}
                  </button>
                )
              })}
              {conversation.assigned_to_id !== null && (
                <button
                  role="menuitem"
                  onClick={() => pick(null)}
                  className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-50 border-t border-zinc-100 mt-1 pt-2"
                >
                  Unassign
                </button>
              )}
            </>
          ) : (
            <form
              className="flex flex-col gap-2 p-1.5"
              onSubmit={(e) => { e.preventDefault(); assign() }}
            >
              <p className="text-sm text-zinc-700">
                {choice === null ? 'Unassign this chat?' : `Assign to ${chosenName}?`}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Add a note for the team (optional)"
                aria-label="Handover note"
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
              />
              {error && <p className="text-xs text-red-500">{apiErrorMessage(error, "Couldn't reassign the chat.")}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setChoice(undefined)} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-2 py-1.5">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="text-xs font-medium bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : choice === null ? 'Unassign' : 'Assign'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
