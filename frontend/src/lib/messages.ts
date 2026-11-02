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
