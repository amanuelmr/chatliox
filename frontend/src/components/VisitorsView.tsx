import { useQuery } from '@tanstack/react-query'
import { getConversations } from '@/api/conversations'
import { getLiveVisitors } from '@/api/visitors'
import { useNow } from '@/hooks/useNow'
import { describeBrowser, latestChat, pageLabel, pagePath, siteName, timeOnSite } from '@/lib/visitor'
import type { Conversation } from '@/types/chat'
import type { LiveVisitor } from '@/types/visitor'

const CHAT_STYLE: Record<Conversation['status'], string> = {
  waiting: 'bg-amber-50 text-amber-700',
  open: 'bg-brand-50 text-brand-700',
  closed: 'bg-emerald-50 text-emerald-700',
}

export function useLiveVisitors() {
  return useQuery({ queryKey: ['visitors'], queryFn: getLiveVisitors })
}

function visitorName(visitor: LiveVisitor, chat: Conversation | undefined): string {
  return chat?.visitor_name ?? chat?.visitor_email ?? `Visitor ${visitor.visitor_id.slice(0, 6)}`
}

// Everyone on the site right now, newest arrival first, kept live by the dashboard socket.
export default function VisitorsView({ onOpenChat }: { onOpenChat: (conversationId: string) => void }) {
  const { data: visitors = [], isLoading } = useLiveVisitors()
  const { data: conversations = [] } = useQuery({ queryKey: ['conversations'], queryFn: () => getConversations() })
  const now = useNow(15_000)

  const sorted = [...visitors].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))

  return (
    <main className="flex-1 bg-page overflow-auto">
      <div className="max-w-5xl mx-auto py-10 px-6 flex flex-col gap-6">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Visitors on your site</h2>
          {!isLoading && <span className="text-xs text-zinc-400 tabular-nums">{visitors.length} now</span>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">Nobody is on your site right now.</p>
            <p className="text-xs text-zinc-400 mt-1">Visitors appear here as soon as a page with the chat widget loads.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                  <th className="px-4 py-3 font-semibold">Visitor</th>
                  <th className="px-4 py-3 font-semibold">Current page</th>
                  <th className="px-4 py-3 font-semibold">On site</th>
                  <th className="px-4 py-3 font-semibold">Pages</th>
                  <th className="px-4 py-3 font-semibold">Came from</th>
                  <th className="px-4 py-3 font-semibold">Chat</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((visitor) => {
                  const chat = latestChat(visitor.visitor_id, conversations)
                  const current = visitor.pages[visitor.pages.length - 1]
                  const browser = describeBrowser(visitor.user_agent)
                  return (
                    <tr key={visitor.visitor_id} className="border-b border-zinc-50 last:border-0 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden />
                          <span className="text-sm font-medium text-zinc-900">{visitorName(visitor, chat)}</span>
                        </div>
                        {browser && <p className="text-[11px] text-zinc-400 mt-0.5 pl-4">{browser}</p>}
                      </td>
                      <td className="px-4 py-3 max-w-[16rem]">
                        {current && (
                          <>
                            <a
                              href={current.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              title={current.url}
                              className="block text-sm text-zinc-800 truncate hover:underline"
                            >
                              {pageLabel(current)}
                            </a>
                            {current.title && <p className="text-[11px] text-zinc-400 truncate">{pagePath(current.url)}</p>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 tabular-nums whitespace-nowrap">
                        {timeOnSite(visitor.arrived_at, now)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 tabular-nums">{visitor.pages.length}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {visitor.referrer ? siteName(visitor.referrer) : <span className="text-zinc-400">Direct</span>}
                      </td>
                      <td className="px-4 py-3">
                        {chat ? (
                          <button
                            type="button"
                            onClick={() => onOpenChat(chat.id)}
                            aria-label={`Open chat with ${visitorName(visitor, chat)}`}
                            className="flex items-center gap-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            <span className={`px-2 py-0.5 rounded-md font-semibold ${CHAT_STYLE[chat.status]}`}>{chat.status}</span>
                            Open
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">No chat</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
