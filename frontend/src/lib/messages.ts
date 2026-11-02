import type { Message } from '@/types/chat'

// Swaps a message shown while sending for the one the server saved. The live
// socket can deliver the saved message before the send request returns; then
// it's already in the list and the placeholder just goes.
export function confirmSent(messages: Message[], tempId: string | undefined, saved: Message): Message[] {
  if (messages.some((m) => m.id === saved.id)) return messages.filter((m) => m.id !== tempId)
  return messages.map((m) => (m.id === tempId ? saved : m))
}
