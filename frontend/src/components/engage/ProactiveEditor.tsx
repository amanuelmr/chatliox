import { useQuery } from '@tanstack/react-query'
import { getProactiveStats, updateProactiveMessages } from '@/api/organizations'
import { NEW_PROACTIVE, describeTrigger } from '@/lib/engage'
import type { ProactiveMessage } from '@/types/auth'
import { FIELD_CLASS } from './EditorParts'
import { useOrgDraft } from './useOrgDraft'

const MAX_MESSAGES = 5

export function useProactiveDraft() {
  return useOrgDraft<ProactiveMessage[]>((org) => org.proactive_messages ?? [], updateProactiveMessages)
}

export function proactiveProblem(messages: ProactiveMessage[]): string | null {
  return messages.some((m) => !m.message.trim()) ? 'Each proactive message needs some text.' : null
}

export default function ProactiveEditor({
  state,
  selected,
  onSelect,
}: {
  state: ReturnType<typeof useProactiveDraft>
  selected: number
  onSelect: (index: number) => void
}) {
  const { draft: messages, setDraft } = state
  const { data: stats = [] } = useQuery({ queryKey: ['proactive-stats'], queryFn: getProactiveStats })
  const chatsFrom = (id?: string) => stats.find((s) => s.id === id)?.chats ?? 0

  const update = (index: number, patch: Partial<ProactiveMessage>) =>
    setDraft(messages.map((m, i) => (i === index ? { ...m, ...patch } : m)))

  return (
    <div className="pb-6 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Proactive messages</h3>
        <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">
          Pop up a message above the chat button when a visitor might need help, like after a while on your pricing page.
          Only visitors who haven't started a chat see them, and only while your team is online.
        </p>
      </div>

      {messages.length === 0 && (
        <p className="text-sm text-zinc-500 bg-zinc-50 rounded-lg px-4 py-6 text-center">
          No proactive messages yet. Add one to start conversations before visitors ask.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <li
            key={m.id ?? `new-${i}`}
            onFocusCapture={() => onSelect(i)}
            onClick={() => onSelect(i)}
            className={`rounded-xl px-4 py-4 flex flex-col gap-3 ring-1 transition-shadow ${
              selected === i ? 'ring-brand-400 shadow-[0_0_0_3px_rgba(79,110,247,0.12)]' : 'ring-zinc-200'
            } ${m.enabled ? '' : 'bg-zinc-50'}`}
            aria-label={`Proactive message ${i + 1}`}
          >
            <div className="flex items-start gap-3">
              <textarea
                value={m.message}
                onChange={(e) => update(i, { message: e.target.value })}
                rows={2}
                maxLength={300}
                autoFocus={m.message === '' && !m.id}
                aria-label={`Message ${i + 1}`}
                placeholder="Comparing plans? I can help you pick one."
                className={`${FIELD_CLASS} resize-none`}
              />
              <button
                type="button"
                role="switch"
                aria-checked={m.enabled}
                aria-label={`Show message ${i + 1}`}
                onClick={() => update(i, { enabled: !m.enabled })}
                className={`mt-1 relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${m.enabled ? 'bg-brand-500' : 'bg-zinc-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[11px] text-zinc-500">Pages containing</span>
                <input
                  type="text"
                  value={m.page_contains}
                  onChange={(e) => update(i, { page_contains: e.target.value })}
                  maxLength={200}
                  placeholder="Any page, or e.g. /pricing"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-500">After (seconds)</span>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={m.delay_seconds}
                  onChange={(e) => update(i, { delay_seconds: Math.min(600, Math.max(0, Number(e.target.value) || 0)) })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-500">From visit</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={m.min_visits}
                  onChange={(e) => update(i, { min_visits: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <select
                value={m.frequency}
                onChange={(e) => update(i, { frequency: e.target.value as ProactiveMessage['frequency'] })}
                aria-label={`How often message ${i + 1} shows`}
                className="text-xs bg-zinc-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="once">Once per visitor</option>
                <option value="every_visit">Once every visit</option>
              </select>
              <p className="text-xs text-zinc-500 flex-1 min-w-[12rem]">{describeTrigger(m)}</p>
              {m.id && (
                <p className="text-xs font-medium text-zinc-700 tabular-nums">
                  {chatsFrom(m.id) === 1 ? '1 chat started' : `${chatsFrom(m.id)} chats started`}
                </p>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDraft(messages.filter((_, j) => j !== i))
                  onSelect(Math.max(0, i - 1))
                }}
                className="text-xs font-medium text-zinc-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>

      {messages.length < MAX_MESSAGES && (
        <button
          type="button"
          onClick={() => {
            setDraft([...messages, { ...NEW_PROACTIVE }])
            onSelect(messages.length)
          }}
          className="self-start text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          + Add a proactive message
        </button>
      )}
    </div>
  )
}
