import type { Message } from '@/types/chat'

const isPlaceholder = (m: Message) => m.id.startsWith('opt-')

// Adds a message that arrived over the live socket. If it's one this window
// sent, it takes the place of the placeholder shown while sending, so the
// message never appears twice while the send request is still finishing.
export function addIncoming(messages: Message[], incoming: Message, isOwn: (m: Message) => boolean): Message[] {
  if (messages.some((m) => m.id === incoming.id)) return messages
  const pending = isOwn(incoming)
    ? messages.findIndex((m) => isPlaceholder(m) && m.content === incoming.content && m.is_internal === incoming.is_internal)
    : -1
  return pending === -1 ? [...messages, incoming] : messages.map((m, i) => (i === pending ? incoming : m))
}

// Swaps a message shown while sending for the one the server saved. The live
// socket may have delivered it already; then the placeholder just goes.
export function confirmSent(messages: Message[], tempId: string | undefined, saved: Message): Message[] {
  if (messages.some((m) => m.id === saved.id)) return messages.filter((m) => m.id !== tempId)
  return messages.map((m) => (m.id === tempId ? saved : m))
}

// Messages from one person within this long of each other read as one group.
const GROUP_GAP_MS = 5 * 60_000

export interface ThreadItem {
  message: Message
  // Set on the first message of each day, e.g. "Today" or "Mon 2 Nov".
  day: string | null
  // First and last message of a run from the same person; times show once per run.
  groupStart: boolean
  groupEnd: boolean
}

function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso)
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}

function sameRun(a: Message, b: Message): boolean {
  return (
    !a.is_internal &&
    !b.is_internal &&
    a.sender_type === b.sender_type &&
    a.sender_id === b.sender_id &&
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() < GROUP_GAP_MS
  )
}

// How the conversation reads: where each day starts and which messages run together.
export function threadLayout(messages: Message[], now: Date = new Date()): ThreadItem[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const day = dayLabel(message.created_at, now)
    const newDay = !prev || dayLabel(prev.created_at, now) !== day
    const nextNewDay = !next || dayLabel(next.created_at, now) !== day
    return {
      message,
      day: newDay ? day : null,
      groupStart: newDay || !sameRun(prev, message),
      groupEnd: nextNewDay || !sameRun(message, next),
    }
  })
}
