import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMacro, getCannedResponses } from '@/api/cannedResponses'
import { getConversations } from '@/api/conversations'
import { getMessages, sendMessage } from '@/api/messages'
import { getLiveVisitors } from '@/api/visitors'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { CannedResponse } from '@/types/cannedResponse'
import type { Conversation, Message, WsEvent } from '@/types/chat'
import type { User } from '@/types/auth'
import type { LiveVisitor } from '@/types/visitor'
import AdminChatWindow from './AdminChatWindow'

vi.mock('@/api/conversations', () => ({
  getConversations: vi.fn(),
  emailTranscript: vi.fn(),
  updateConversationStatus: vi.fn(),
  updateConversationTags: vi.fn(),
}))
vi.mock('@/api/messages', () => ({ getMessages: vi.fn(), sendMessage: vi.fn(), uploadAttachment: vi.fn() }))
vi.mock('@/api/cannedResponses', () => ({ getCannedResponses: vi.fn(), applyMacro: vi.fn() }))
vi.mock('@/api/visitors', () => ({ getLiveVisitors: vi.fn() }))

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
const typing = (user_id: string, sender_type: 'admin' | 'visitor', name: string | null, is_typing = true, draft?: string) =>
  emit({ type: 'typing', user_id, sender_type, name, is_typing, draft })

const macro = (id: string, title: string, shortcut: string, content: string, patch: Partial<CannedResponse> = {}) =>
  ({
    id, title, shortcut, content, use_count: 0, created_at: '',
    actions: { add_tags: [], assign: null, resolve: false },
    ...patch,
  }) as CannedResponse

const MACROS = [
  macro('m1', 'Greeting', 'hi', 'Hi there!'),
  macro('m2', 'Refund policy', 'refund', 'Refunds take 5 days.', {
    actions: { add_tags: ['refund'], assign: null, resolve: true },
  }),
  macro('m3', 'Spam', 'spam', '', { actions: { add_tags: ['spam'], assign: null, resolve: true } }),
]

async function openChat(patch: Partial<Conversation> = {}, live: LiveVisitor[] = []) {
  useAuthStore.getState().setAuth('token', { id: 'me', full_name: 'Wes' } as User)
  vi.mocked(getConversations).mockResolvedValue([
    { id: 'c1', visitor_id: 'vera', visitor_name: 'Vera', status: 'open', tags: [], pre_chat_answers: [], visitor_pages: [], ...patch } as Conversation,
  ])
  vi.mocked(getLiveVisitors).mockResolvedValue(live)
  vi.mocked(getMessages).mockResolvedValue([])
  vi.mocked(getCannedResponses).mockResolvedValue(MACROS)
  renderAt(<AdminChatWindow conversationId="c1" />)
  await screen.findAllByText('Vera')
}

describe('agent chat window', () => {
  beforeEach(() => openChat())

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

  it('previews what the visitor is typing until they stop', async () => {
    await typing('visitor-1', 'visitor', null, true, 'My order still hasn')
    expect(screen.getByText('Typing preview')).toBeInTheDocument()
    expect(screen.getByText('My order still hasn')).toBeInTheDocument()

    // Clearing the box keeps the indicator but drops the preview.
    await typing('visitor-1', 'visitor', null, true)
    expect(screen.queryByText('Typing preview')).not.toBeInTheDocument()
    expect(screen.getByText('Visitor is typing…')).toBeInTheDocument()

    await typing('visitor-1', 'visitor', null, true, 'Where is it?')
    await typing('visitor-1', 'visitor', null, false)
    expect(screen.queryByText('Where is it?')).not.toBeInTheDocument()
  })
})

describe('visitor details', () => {
  it('shows where the visitor came from, their browser and the pages they viewed', async () => {
    await openChat({
      visitor_user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      visitor_referrer: 'https://www.search.test/?q=boots',
      visitor_pages: [
        { url: 'https://shop.test/', title: 'Shop', at: '2026-11-02T10:00:00Z' },
        { url: 'https://shop.test/boots?size=9', title: '', at: '2026-11-02T10:02:00Z' },
      ],
    })
    expect(screen.getByText('Chrome 130 on macOS')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'search.test' })).toHaveAttribute('href', 'https://www.search.test/?q=boots')

    // Newest first; a page without a title is shown by its path.
    const trail = within(screen.getByRole('list', { name: 'Pages viewed' }))
    expect(trail.getAllByRole('link').map((a) => a.textContent)).toEqual(['/boots?size=9', 'Shop'])
    expect(screen.queryByText(/On the site now/)).not.toBeInTheDocument()
  })

  it('says which page the visitor is on while they are still on the site', async () => {
    await openChat({}, [
      {
        visitor_id: 'vera', arrived_at: '', user_agent: null, referrer: null,
        pages: [
          { url: 'https://shop.test/', title: 'Shop', at: '' },
          { url: 'https://shop.test/checkout', title: 'Checkout', at: '' },
        ],
      },
    ])
    expect(await screen.findByText(/On the site now, viewing/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', 'https://shop.test/checkout')
  })
})

describe('saved replies in the reply box', () => {
  beforeEach(async () => {
    vi.mocked(applyMacro).mockReset()
    vi.mocked(sendMessage).mockReset().mockResolvedValue({ id: 'sent' } as Message)
    vi.mocked(applyMacro).mockResolvedValue({
      conversation: { id: 'c1', visitor_name: 'Vera', status: 'closed', tags: ['refund'], pre_chat_answers: [], visitor_pages: [] } as unknown as Conversation,
      message: null,
    })
    await openChat()
    // The saved replies load in the background; wait so "/" has something to match.
    await vi.waitFor(() => expect(getCannedResponses).toHaveBeenCalled())
  })

  const reply = () => screen.getByLabelText('Reply')

  it('finds a saved reply by "/" and its shortcut, picked from the keyboard', async () => {
    await userEvent.type(reply(), '/re')
    const menu = screen.getByRole('listbox', { name: 'Saved replies' })
    // The shortcut match comes before "Greeting", which only matches by title.
    expect(within(menu).getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Refund policy'),
      expect.stringContaining('Greeting'),
    ])

    await userEvent.keyboard('{Enter}')
    expect(reply()).toHaveValue('Refunds take 5 days.')
    expect(screen.getByText('⚡ Refund policy')).toBeInTheDocument()
    expect(screen.getByText('Adds #refund · Resolves')).toBeInTheDocument()

    // The agent personalises the text, then sends; the actions run with it.
    await userEvent.type(reply(), ' Sorry, Vera!')
    await userEvent.click(screen.getByRole('button', { name: 'Send & apply' }))
    expect(applyMacro).toHaveBeenCalledWith('m2', 'c1', 'Refunds take 5 days. Sorry, Vera!')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('moves through matches with the arrow keys and closes with Escape', async () => {
    await userEvent.type(reply(), '/')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(reply()).toHaveValue('')
  })

  it('runs an actions-only macro without a reply', async () => {
    await userEvent.type(reply(), '/spam{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(applyMacro).toHaveBeenCalledWith('m3', 'c1', '')
  })

  it('sends plain text as an ordinary reply once the saved reply is dropped', async () => {
    await userEvent.type(reply(), '/hi{Enter}')
    await userEvent.click(screen.getByRole('button', { name: "Don't use this saved reply" }))
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(applyMacro).not.toHaveBeenCalled()
    expect(vi.mocked(sendMessage).mock.calls[0][0]).toEqual(
      expect.objectContaining({ content: 'Hi there!', conversation_id: 'c1' }),
    )
  })
})
