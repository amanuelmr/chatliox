// What a visitor sees before starting a chat: a few messages from the team,
// then one-tap starters. Shared by the widget and the dashboard's preview.

export function TeamBubbles({ messages, brandColor, teamName }: { messages: string[]; brandColor: string; teamName: string }) {
  if (messages.length === 0) return null
  return (
    <div className="flex items-end gap-2" aria-label={`Messages from ${teamName}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-white"
        style={{ backgroundColor: brandColor }}
        aria-hidden
      >
        {teamName.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-[11px] text-zinc-400 pl-1">{teamName}</p>
        {messages.map((text, i) => (
          <p
            key={i}
            className={`max-w-[15rem] bg-white ring-1 ring-zinc-200/80 text-sm text-zinc-800 leading-snug px-3.5 py-2 whitespace-pre-wrap break-words rounded-2xl ${
              // The last bubble points at the avatar, like one person sending several messages.
              i === messages.length - 1 ? 'rounded-bl-md' : ''
            }`}
          >
            {text}
          </p>
        ))}
      </div>
    </div>
  )
}

export function QuickReplies({
  replies,
  brandColor,
  onPick,
  disabled = false,
}: {
  replies: string[]
  brandColor: string
  onPick?: (reply: string) => void
  disabled?: boolean
}) {
  if (replies.length === 0) return null
  return (
    <div className="flex flex-wrap justify-end gap-1.5" role="group" aria-label="Suggested messages">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          disabled={disabled}
          onClick={() => onPick?.(reply)}
          style={{ color: brandColor, borderColor: brandColor }}
          className="text-[13px] font-medium px-3 py-1.5 rounded-full border-[1.5px] bg-white transition-colors duration-150 hover:bg-zinc-50 disabled:opacity-50"
        >
          {reply}
        </button>
      ))}
    </div>
  )
}
