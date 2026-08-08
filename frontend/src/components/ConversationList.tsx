import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getConversations } from '@/api/conversations'
import type { Conversation, ConversationStatus } from '@/types/chat'

type Filter = 'all' | ConversationStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function visitorLabel(c: Conversation): string {
  return c.visitor_name ?? c.visitor_email ?? 'Anonymous'
}

const AVATAR_PALETTE = [
  'bg-brand-100 text-brand-700',
  'bg-sky-100 text-sky-700',
  'bg-teal-100 text-teal-700',
  'bg-violet-100 text-violet-700',
  'bg-zinc-100 text-zinc-600',
]

function avatarStyle(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

interface Props {
  activeId?: string
  onSelect: (id: string) => void
}

export default function ConversationList({ activeId, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const trimmedSearch = search.trim()

  // The dashboard WebSocket (useDashboardSocket) keeps this live; refetchInterval
  // is just a safety net in case that connection drops silently.
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
    refetchInterval: 60_000,
  })

  // Full-text search hits the backend (message content isn't in the list
  // payload) and lives in its own cache entry so it never fights the
  // WebSocket-driven ['conversations'] list.
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['conversations-search', trimmedSearch],
    queryFn: () => getConversations({ q: trimmedSearch }),
    enabled: trimmedSearch.length > 0,
  })

  const base = trimmedSearch ? (searchResults ?? []) : conversations
  const byStatus = filter === 'all' ? base : base.filter((c) => c.status === filter)
  const filtered = activeTag ? byStatus.filter((c) => c.tags.includes(activeTag)) : byStatus

  const waitingCount = conversations.filter((c) => c.status === 'waiting').length

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Search */}
      <div className="px-3 pt-1 pb-2 flex-shrink-0">
        <div className="relative">
          <svg className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or message…"
            className="w-full text-xs bg-zinc-100 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-200"
          />
        </div>
        {activeTag && (
          <button
            onClick={() => setActiveTag(null)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium bg-brand-50 text-brand-700 rounded-full px-2 py-0.5"
          >
            #{activeTag} ×
          </button>
        )}
      </div>

      {/* macOS-style segmented control */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex bg-zinc-100 p-0.5 rounded-lg">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 relative text-xs py-1 rounded-md transition-all duration-200 ${
                filter === key
                  ? 'bg-white shadow text-zinc-900 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 font-medium'
              }`}
            >
              {label}
              {key === 'waiting' && waitingCount > 0 && (
                <span className="ml-1 text-[10px] font-semibold bg-brand-500 text-white rounded-full px-1.5 py-0">
                  {waitingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {(isLoading || (trimmedSearch && searching)) && (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
          </div>
        )}

        {!isLoading && !searching && filtered.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-12">No conversations yet.</p>
        )}

        {filtered.map((c) => (
          <Row
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            onClick={() => onSelect(c.id)}
            onTagClick={setActiveTag}
          />
        ))}
      </div>
    </div>
  )
}

function Row({
  conversation: c,
  isActive,
  onClick,
  onTagClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onTagClick: (tag: string) => void
}) {
  const isWaiting = c.status === 'waiting'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border-l-2 transition-all duration-150 ${
        isActive
          ? 'bg-zinc-50 border-l-indigo-500'
          : 'border-l-transparent hover:bg-zinc-50'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${avatarStyle(c.id)}`}>
          {(visitorLabel(c)[0] ?? '?').toUpperCase()}
        </div>
        {isWaiting && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-brand-500 rounded-full ring-2 ring-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className={`text-sm truncate ${
            isWaiting ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'
          }`}>
            {visitorLabel(c)}
          </span>
          <span className="text-[11px] text-zinc-400 flex-shrink-0 tabular-nums">
            {timeAgo(c.last_message_at)}
          </span>
        </div>
        <p className="text-xs text-zinc-400 truncate">
          {c.assigned_to_name
            ? <span className="text-indigo-500 font-medium">{c.assigned_to_name}</span>
            : c.visitor_email ?? (c.status === 'closed' ? 'Resolved' : 'No reply yet')}
        </p>
        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {c.tags.map((tag) => (
              <span
                key={tag}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag) }}
                className="text-[10px] font-medium bg-zinc-100 hover:bg-brand-50 hover:text-brand-700 text-zinc-500 rounded-full px-1.5 py-0.5 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
