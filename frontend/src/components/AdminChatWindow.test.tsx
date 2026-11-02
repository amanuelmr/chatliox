import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getConversations } from '@/api/conversations'
import { getMessages } from '@/api/messages'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { Conversation, WsEvent } from '@/types/chat'
import type { User } from '@/types/auth'
import AdminChatWindow from './AdminChatWindow'

vi.mock('@/api/conversations', () => ({
  getConversations: vi.fn(),
  emailTranscript: vi.fn(),
  updateConversationStatus: vi.fn(),
  updateConversationTags: vi.fn(),
}))
vi.mock('@/api/messages', () => ({ getMessages: vi.fn(), sendMessage: vi.fn(), uploadAttachment: vi.fn() }))
vi.mock('@/api/cannedResponses', () => ({ getCannedResponses: vi.fn().mockResolvedValue([]) }))

// Lets the test play the server's side of the conversation socket.
class FakeSocket {
  static latest: FakeSocket
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 1
  constructor() { FakeSocket.latest = this }
  send() {}
  close() {}
}
vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }))

const ME = { user_id: 'me', name: 'Wes' }
const SAM = { user_id: 'sam', name: 'Sam' }

const emit = (event: WsEvent) => act(() => FakeSocket.latest.onmessage?.({ data: JSON.stringify(event) }))
const typing = (user_id: string, sender_type: 'admin' | 'visitor', name: string | null, is_typing = true) =>
  emit({ type: 'typing', user_id, sender_type, name, is_typing })

describe('agent chat window', () => {
  beforeEach(async () => {
    useAuthStore.getState().setAuth('token', { id: 'me', full_name: 'Wes' } as User)
    vi.mocked(getConversations).mockResolvedValue([
      { id: 'c1', visitor_name: 'Vera', status: 'open', tags: [], pre_chat_answers: [] } as unknown as Conversation,
    ])
    vi.mocked(getMessages).mockResolvedValue([])
    renderAt(<AdminChatWindow conversationId="c1" />)
    await screen.findAllByText('Vera')
  })

  it('shows which teammates also have the chat open, but not yourself', async () => {
    await emit({ type: 'viewers', agents: [ME] })
    expect(screen.queryByText(/also viewing/)).not.toBeInTheDocument()

    await emit({ type: 'viewers', agents: [ME, SAM] })
    expect(screen.getByText('Sam is also viewing')).toBeInTheDocument()

    await emit({ type: 'viewers', agents: [ME, SAM, { user_id: 'ana', name: 'Ana' }] })
    expect(screen.getByText('Sam and Ana are also viewing')).toBeInTheDocument()
  })

  it("tells a teammate's typing apart from the visitor's", async () => {
    await emit({ type: 'viewers', agents: [ME, SAM] })
    await typing('sam', 'admin', 'Sam')
    expect(screen.getByText('Sam is typing a reply…')).toBeInTheDocument()
    expect(screen.queryByText('Visitor is typing…')).not.toBeInTheDocument()

    await typing('visitor-1', 'visitor', null)
    expect(screen.getByText('Visitor is typing…')).toBeInTheDocument()

    // Sam closes the chat without sending "stopped typing".
    await emit({ type: 'viewers', agents: [ME] })
    expect(screen.queryByText(/typing a reply/)).not.toBeInTheDocument()
    expect(screen.getByText('Visitor is typing…')).toBeInTheDocument()
  })
})
