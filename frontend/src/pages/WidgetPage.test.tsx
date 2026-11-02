import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createConversation,
  emailVisitorTranscript,
  getVisitorConversationStatus,
} from '@/api/conversations'
import { getVisitorMessages, sendMessage } from '@/api/messages'
import { getWidgetConfig, type WidgetConfig } from '@/api/organizations'
import { renderAt } from '@/test/render'
import type { Conversation, Message } from '@/types/chat'
import WidgetPage from './WidgetPage'

vi.mock('@/api/conversations', () => ({
  createConversation: vi.fn(),
  emailVisitorTranscript: vi.fn(),
  getVisitorConversationStatus: vi.fn(),
  submitCsat: vi.fn(),
}))
vi.mock('@/api/messages', () => ({
  getVisitorMessages: vi.fn(),
  sendMessage: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('@/api/organizations', () => ({ getWidgetConfig: vi.fn() }))

// The chat view opens a live connection; this records what the widget sends on it.
class FakeSocket {
  static sent: Record<string, unknown>[] = []
  onopen: (() => void) | null = null
  onmessage: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readyState = 1
  send(data: string) { FakeSocket.sent.push(JSON.parse(data)) }
  close() {}
}
vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }))

const KEY = 'widget-key'

const config = (patch: Partial<WidgetConfig> = {}): WidgetConfig => ({
  name: 'Acme',
  widget_color: '#4f6ef7',
  widget_greeting: 'Hi there',
  widget_position: 'right',
  widget_icon_url: null,
  widget_width: 376,
  widget_height: 600,
  widget_offset_x: 20,
  widget_offset_y: 20,
  business_hours_enabled: false,
  away_message: "We're away",
  pre_chat_name: 'optional',
  pre_chat_email: 'optional',
  pre_chat_fields: [],
  first_response_minutes: null,
  typing_preview: true,
  welcome_messages: [],
  quick_replies: [],
  proactive_messages: [],
  widget_devices: 'all',
  widget_hidden_paths: [],
  widget_allowed_domains: [],
  is_online: true,
  ...patch,
})

async function openWidget(widgetConfig: WidgetConfig) {
  vi.mocked(getWidgetConfig).mockResolvedValue(widgetConfig)
  renderAt(<WidgetPage />, `/widget?key=${KEY}`)
  await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
}

const sendButton = () => screen.getByRole('button', { name: /send message|leave a message/i })

describe('widget pre-chat form', () => {
  beforeEach(() => {
    vi.mocked(createConversation).mockResolvedValue({ id: 'c1' } as Conversation)
    vi.mocked(sendMessage).mockResolvedValue({} as Message)
    vi.mocked(getVisitorMessages).mockResolvedValue([])
    vi.mocked(getVisitorConversationStatus).mockResolvedValue({ status: 'waiting', has_email: false })
  })

  it('holds the message until required answers are given, then sends them', async () => {
    await openWidget(
      config({
        pre_chat_name: 'required',
        pre_chat_email: 'hidden',
        pre_chat_fields: [
          { id: 'order', label: 'Order number', type: 'text', options: [], required: true },
          { id: 'topic', label: 'Topic', type: 'select', options: ['Billing', 'Shipping'], required: false },
        ],
      }),
    )
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/your email/i)).not.toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('How can we help you?'), 'Where is my parcel?')
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Vi')
    expect(sendButton()).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText('Order number'), ' A-1 ')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Topic' }), 'Shipping')
    await userEvent.click(sendButton())

    expect(createConversation).toHaveBeenCalledWith({
      visitor_id: expect.any(String),
      visitor_name: 'Vi',
      visitor_email: undefined,
      widget_key: KEY,
      pre_chat_answers: { order: 'A-1', topic: 'Shipping' },
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'c1',
        content: 'Where is my parcel?',
        sender_type: 'visitor',
        visitor_id: expect.any(String),
      }),
    )
  })

  it('requires a valid email while the team is away', async () => {
    await openWidget(config({ is_online: false, pre_chat_email: 'hidden' }))
    expect(await screen.findByText("We're away")).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('How can we help you?'), 'Hello')
    expect(sendButton()).toBeDisabled()
    await userEvent.type(screen.getByPlaceholderText('Your email'), 'not-an-email')
    expect(sendButton()).toBeDisabled()
    await userEvent.clear(screen.getByPlaceholderText('Your email'))
    await userEvent.type(screen.getByPlaceholderText('Your email'), 'vi@example.com')
    expect(sendButton()).toBeEnabled()
  })
})

describe('widget expected reply time', () => {
  it('shows the team target while online, and not while away', async () => {
    await openWidget(config({ first_response_minutes: 15 }))
    expect(await screen.findByText('Usually replies within 15 minutes')).toBeInTheDocument()
  })

  it('is left out while the team is away', async () => {
    await openWidget(config({ first_response_minutes: 15, is_online: false }))
    await screen.findByText("We're away")
    expect(screen.queryByText(/Usually replies/)).not.toBeInTheDocument()
  })
})

describe('widget transcript request', () => {
  beforeEach(() => {
    localStorage.setItem(`chatliox_conversation_id_${KEY}`, 'c1')
    vi.mocked(getVisitorMessages).mockResolvedValue([
      { id: 'm1', content: 'Hi', sender_type: 'visitor', created_at: new Date().toISOString() } as Message,
    ])
    vi.mocked(emailVisitorTranscript).mockResolvedValue(undefined)
  })

  it('sends straight away when an email is on file', async () => {
    vi.mocked(getVisitorConversationStatus).mockResolvedValue({ status: 'open', has_email: true })
    await openWidget(config())
    await userEvent.click(await screen.findByRole('button', { name: 'Email me a transcript' }))
    expect(emailVisitorTranscript).toHaveBeenCalledWith('c1', expect.any(String), undefined)
    expect(await screen.findByText('Transcript sent to your email.')).toBeInTheDocument()
  })

  it('asks for an email when the visitor never left one', async () => {
    vi.mocked(getVisitorConversationStatus).mockResolvedValue({ status: 'open', has_email: false })
    await openWidget(config())
    await userEvent.click(await screen.findByRole('button', { name: 'Email me a transcript' }))

    const form = screen.getByRole('textbox', { name: 'Your email' }).closest('form')!
    await userEvent.type(within(form).getByRole('textbox'), 'vi@example.com')
    await userEvent.click(within(form).getByRole('button', { name: 'Send' }))
    expect(emailVisitorTranscript).toHaveBeenCalledWith('c1', expect.any(String), 'vi@example.com')
  })
})

describe('widget typing preview', () => {
  beforeEach(() => {
    FakeSocket.sent = []
    localStorage.setItem(`chatliox_conversation_id_${KEY}`, 'c1')
    vi.mocked(getVisitorMessages).mockResolvedValue([])
    vi.mocked(getVisitorConversationStatus).mockResolvedValue({ status: 'open', has_email: false })
  })

  const typed = () => FakeSocket.sent.filter((e) => e.type === 'typing')

  it('shares the draft with the team while typing', async () => {
    await openWidget(config())
    await userEvent.type(await screen.findByPlaceholderText('Type a message…'), 'Hey')
    expect(typed()[typed().length - 1]).toEqual({ type: 'typing', is_typing: true, draft: 'Hey' })
  })

  it('keeps the draft private when the team turned the preview off', async () => {
    await openWidget(config({ typing_preview: false }))
    await userEvent.type(await screen.findByPlaceholderText('Type a message…'), 'Hey')
    expect(typed().length).toBeGreaterThan(0)
    expect(typed().every((e) => !('draft' in e))).toBe(true)
  })
})

describe('widget welcome', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(createConversation).mockReset().mockResolvedValue({ id: 'c1' } as Conversation)
    vi.mocked(sendMessage).mockReset().mockResolvedValue({} as Message)
    vi.mocked(getVisitorMessages).mockResolvedValue([])
    vi.mocked(getVisitorConversationStatus).mockResolvedValue({ status: 'waiting', has_email: false })
  })

  const welcoming = (patch: Partial<WidgetConfig> = {}) =>
    config({ welcome_messages: ['Hi there!', 'Ask us anything.'], quick_replies: ['Pricing', 'Shipping'], ...patch })

  it('greets the visitor, and a quick reply starts the chat in one tap', async () => {
    await openWidget(welcoming())
    const team = await screen.findByLabelText('Messages from Acme')
    expect(within(team).getByText('Hi there!')).toBeInTheDocument()
    expect(within(team).getByText('Ask us anything.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Shipping' }))
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(vi.mocked(sendMessage).mock.calls[0][0]).toEqual(expect.objectContaining({ content: 'Shipping' }))
    // The greeting stays at the top of the conversation the visitor replied to.
    expect(await screen.findByLabelText('Messages from Acme')).toBeInTheDocument()
  })

  it('waits for required details before sending a quick reply', async () => {
    await openWidget(welcoming({ pre_chat_name: 'required' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pricing' }))
    expect(createConversation).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('How can we help you?')).toHaveValue('Pricing')

    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Vi')
    await userEvent.click(sendButton())
    await vi.waitFor(() => expect(createConversation).toHaveBeenCalled())
  })
})
