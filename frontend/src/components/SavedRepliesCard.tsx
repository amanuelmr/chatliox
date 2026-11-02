import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCannedResponse,
  deleteCannedResponse,
  getCannedResponses,
  updateCannedResponse,
} from '@/api/cannedResponses'
import { apiErrorMessage } from '@/lib/apiError'
import { NO_ACTIONS, describeActions, hasActions, parseTags } from '@/lib/macros'
import type { CannedResponse, MacroActions } from '@/types/cannedResponse'

const SHORTCUT_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

interface Draft {
  title: string
  shortcut: string
  content: string
  tags: string
  assign: MacroActions['assign']
  resolve: boolean
}

const EMPTY: Draft = { title: '', shortcut: '', content: '', tags: '', assign: null, resolve: false }

const toDraft = (r: CannedResponse): Draft => ({
  title: r.title,
  shortcut: r.shortcut ?? '',
  content: r.content,
  tags: r.actions.add_tags.join(', '),
  assign: r.actions.assign,
  resolve: r.actions.resolve,
})

const INPUT = 'rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition'

// Settings → Saved replies: text agents insert with "/" or the toolbar, plus optional
// actions that tag, assign and resolve the chat in the same step.
export default function SavedRepliesCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  // The saved reply being edited, or null when adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: getCannedResponses,
  })

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const reset = () => { setDraft(EMPTY); setEditingId(null) }

  const actions: MacroActions = { add_tags: parseTags(draft.tags), assign: draft.assign, resolve: draft.resolve }
  const shortcut = draft.shortcut.trim().replace(/^\//, '').toLowerCase()
  const problem = !draft.title.trim()
    ? 'Give it a title.'
    : shortcut && !SHORTCUT_PATTERN.test(shortcut)
      ? 'Shortcuts use lowercase letters, numbers and dashes.'
      : !draft.content.trim() && !hasActions(actions)
        ? 'Add reply text or at least one action.'
        : actions.add_tags.length > 5
          ? 'Add up to five tags.'
          : null

  const { mutate: save, isPending: saving, error } = useMutation({
    mutationFn: () => {
      const body = { title: draft.title.trim(), content: draft.content.trim(), shortcut: shortcut || null, actions }
      return editingId ? updateCannedResponse(editingId, body) : createCannedResponse(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      reset()
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => deleteCannedResponse(id),
    onSuccess: (_, id) => {
      if (id === editingId) reset()
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
    },
  })

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <p className="text-sm font-semibold text-zinc-900">Saved replies</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Type / and a shortcut in the reply box to use one. Actions can tag, assign and resolve the chat in the same step.
        </p>
      </div>

      <form
        className="px-6 py-4 flex flex-col gap-2.5 border-b border-zinc-100"
        onSubmit={(e) => { e.preventDefault(); if (!problem) save() }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Title"
            placeholder="Title (e.g. Refund policy)"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            className={`flex-1 min-w-0 ${INPUT}`}
          />
          <div className="relative w-36 flex-shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono">/</span>
            <input
              type="text"
              aria-label="Shortcut"
              placeholder="shortcut"
              value={draft.shortcut}
              onChange={(e) => set({ shortcut: e.target.value })}
              className={`w-full pl-6 font-mono ${INPUT}`}
            />
          </div>
        </div>
        <textarea
          aria-label="Reply text"
          placeholder="Reply text (leave empty for an actions-only macro)"
          value={draft.content}
          onChange={(e) => set({ content: e.target.value })}
          rows={3}
          className={`resize-none ${INPUT}`}
        />

        <fieldset className="flex flex-col gap-2 rounded-lg bg-zinc-50 px-3 py-2.5">
          <legend className="sr-only">Actions</legend>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Then</p>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <span className="w-16 flex-shrink-0">Add tags</span>
            <input
              type="text"
              placeholder="refund, billing"
              value={draft.tags}
              onChange={(e) => set({ tags: e.target.value })}
              className="flex-1 min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <span className="w-16 flex-shrink-0">Assign</span>
            <select
              value={draft.assign ?? ''}
              onChange={(e) => set({ assign: (e.target.value || null) as MacroActions['assign'] })}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
            >
              <option value="">Leave as is</option>
              <option value="me">To whoever uses it</option>
              <option value="unassign">Unassign</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={draft.resolve}
              onChange={(e) => set({ resolve: e.target.checked })}
              className="rounded border-zinc-300 text-brand-500 focus:ring-brand-100"
            />
            Resolve the chat
          </label>
        </fieldset>

        {draft.title && problem && <p className="text-xs text-red-500">{problem}</p>}
        {error && <p className="text-xs text-red-500">{apiErrorMessage(error, "Couldn't save the reply.")}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={Boolean(problem) || saving}
            className="text-sm font-medium bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-all duration-200"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add saved reply'}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
              Cancel
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <div className="px-6 py-6 flex justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
        </div>
      ) : replies.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-6">No saved replies yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {replies.map((r) => {
            const steps = describeActions(r.actions ?? NO_ACTIONS)
            return (
              <li key={r.id} className={`flex items-start gap-3 px-6 py-3.5 ${r.id === editingId ? 'bg-brand-50/50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    <span className="truncate">{r.title}</span>
                    {r.shortcut && <span className="flex-shrink-0 font-mono text-xs text-zinc-400">/{r.shortcut}</span>}
                  </p>
                  {r.content && <p className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap break-words">{r.content}</p>}
                  {steps.length > 0 && <p className="text-[11px] text-brand-600 font-medium mt-1">⚡ {steps.join(' · ')}</p>}
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {r.use_count === 0 ? 'Not used yet' : `Used ${r.use_count} time${r.use_count === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button
                  onClick={() => { setDraft(toDraft(r)); setEditingId(r.id) }}
                  className="flex-shrink-0 text-xs font-medium text-zinc-400 hover:text-zinc-800 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-all duration-150"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(r.id)}
                  title="Delete"
                  aria-label={`Delete ${r.title}`}
                  className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
