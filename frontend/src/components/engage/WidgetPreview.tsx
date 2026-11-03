import type { ReactNode } from 'react'
import { QuickReplies, TeamBubbles } from '@/components/widget/WelcomeThread'
import { formatMinutes } from '@/lib/responseTime'
import type { WidgetPosition } from '@/types/auth'

export type PreviewState = 'open' | 'closed'

interface Props {
  brandColor: string
  teamName: string
  greeting: string
  position: WidgetPosition
  // The team's first-response target, which the widget header shows.
  replyWithinMinutes: number | null
  welcomeMessages: string[]
  quickReplies: string[]
  state: PreviewState
  pageUrl: string
  // A proactive message popping up above the launcher (closed state only).
  teaser?: string | null
  // Why the widget wouldn't load on this page, if it wouldn't.
  hiddenReason?: string | null
}

const CHAT_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
)

// A customer's page with the widget on it, drawn from the settings being edited,
// so the team sees what visitors will get before saving.
export default function WidgetPreview(props: Props) {
  const { brandColor, position, state, pageUrl, teaser, hiddenReason } = props
  // Top corners put the launcher first, with the chat opening below it.
  const top = position.startsWith('top')
  const side = `${position.endsWith('left') ? 'left-4 items-start' : 'right-4 items-end'} ${top ? 'top-4 flex-col-reverse' : 'bottom-4 flex-col'}`

  return (
    <figure className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-[0_24px_60px_-28px_rgba(24,24,27,0.35)] overflow-hidden" aria-label="Widget preview">
      {/* Address bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
        </span>
        <p className="flex-1 min-w-0 truncate text-xs text-zinc-500 bg-white rounded-md px-2.5 py-1 ring-1 ring-zinc-200" title={pageUrl}>
          {pageUrl}
        </p>
      </div>

      {/* The customer's page, sketched */}
      <div className="relative h-[560px] bg-white overflow-hidden">
        <div className="p-6 flex flex-col gap-3 opacity-70" aria-hidden>
          <div className="h-3 w-24 rounded bg-zinc-200" />
          <div className="mt-4 h-6 w-3/4 rounded bg-zinc-100" />
          <div className="h-6 w-1/2 rounded bg-zinc-100" />
          <div className="mt-2 h-2.5 w-5/6 rounded bg-zinc-100" />
          <div className="h-2.5 w-2/3 rounded bg-zinc-100" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-20 rounded-lg bg-zinc-100" />
            <div className="h-20 rounded-lg bg-zinc-100" />
            <div className="h-20 rounded-lg bg-zinc-100" />
          </div>
        </div>

        {hiddenReason ? (
          <div className="absolute inset-x-6 bottom-6 rounded-xl bg-zinc-900/85 text-white px-4 py-3" role="status">
            <p className="text-sm font-medium">The widget won't load here</p>
            <p className="text-xs text-white/70 mt-0.5">{hiddenReason}</p>
          </div>
        ) : (
          <div className={`absolute flex gap-3 ${side}`}>
            {state === 'open' ? <Panel {...props} /> : teaser ? <Teaser text={teaser} {...props} /> : null}
            <span
              className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg relative"
              style={{ backgroundColor: brandColor }}
              aria-hidden
            >
              {state === 'open' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : CHAT_ICON}
              {state === 'closed' && teaser && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-semibold leading-4 text-center ring-2 ring-white">
                  1
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </figure>
  )
}

function Panel({ brandColor, teamName, greeting, welcomeMessages, quickReplies, replyWithinMinutes }: Props) {
  return (
    <div className="w-[300px] h-[440px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden flex flex-col">
      <div style={{ backgroundColor: brandColor }} className="px-4 pt-3.5 pb-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">{CHAT_ICON}</span>
          <div>
            {/* Same wording as the widget's header before an agent has replied. */}
            <p className="text-sm font-semibold leading-tight">Support</p>
            <p className="text-[11px] text-white/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {replyWithinMinutes === null
                ? 'We typically reply in a few minutes'
                : `Usually replies within ${formatMinutes(replyWithinMinutes)}`}
            </p>
          </div>
        </div>
        <p className="text-xs text-white/70 mt-3 leading-relaxed">{greeting}</p>
      </div>
      <div className="flex-1 bg-zinc-50/60 px-3.5 py-3.5 flex flex-col gap-3 overflow-hidden">
        <TeamBubbles messages={welcomeMessages} brandColor={brandColor} teamName={teamName} />
        <QuickReplies replies={quickReplies} brandColor={brandColor} />
        {welcomeMessages.length === 0 && quickReplies.length === 0 && (
          <p className="m-auto text-xs text-zinc-400 text-center max-w-[12rem]">
            Add a welcome message or a quick reply to see it here.
          </p>
        )}
      </div>
      <div className="px-3.5 py-3 border-t border-zinc-100">
        <p className="text-sm text-zinc-400 bg-zinc-50 rounded-xl px-3 py-2">How can we help you?</p>
      </div>
    </div>
  )
}

function Teaser({ text, brandColor, teamName }: Props & { text: string }): ReactNode {
  return (
    <div className="w-[260px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 px-4 py-3.5 flex gap-3">
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
        style={{ backgroundColor: brandColor }}
      >
        {teamName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-400">{teamName}</p>
        <p className="text-sm text-zinc-800 leading-snug whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  )
}
