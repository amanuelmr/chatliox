import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getConversations } from '@/api/conversations'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { User } from '@/types/auth'
import type { Conversation } from '@/types/chat'
import ConversationList from './ConversationList'

vi.mock('@/api/conversations', () => ({ getConversations: vi.fn() }))

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const chat = (id: string, patch: Partial<Conversation>): Conversation => ({
  id,
  visitor_id: id,
  visitor_name: id,
  visitor_email: null,
  status: 'open',
  last_message_at: minutesAgo(1),
  created_at: minutesAgo(1),
  assigned_to_id: null,
  assigned_to_name: null,
  tags: [],
  csat_rating: null,
  pre_chat_answers: [],
  ...patch,
})

function signIn() {
  useAuthStore.getState().setAuth('token', { id: 'me' } as User)
}

async function showList(conversations: Conversation[]) {
  vi.mocked(getConversations).mockResolvedValue(conversations)
  renderAt(<ConversationList onSelect={() => {}} />)
  await screen.findByText(conversations[0].visitor_name!)
}

const names = () => screen.queryAllByRole('button').map((b) => b.textContent ?? '')
const listed = (name: string) => names().some((n) => n.includes(name))

describe('inbox views', () => {
  beforeEach(() => signIn())

  it('narrows to my chats or unassigned ones, and remembers the choice', async () => {
    await showList([
      chat('Mia', { assigned_to_id: 'me', assigned_to_name: 'Wes' }),
      chat('Nia', { assigned_to_id: 'sam', assigned_to_name: 'Sam' }),
      chat('Una', {}),
      chat('Old', { assigned_to_id: 'me', assigned_to_name: 'Wes', status: 'closed' }),
    ])
    const views = screen.getByRole('tablist', { name: 'Inbox view' })
    // Counts leave resolved chats out.
    expect(within(views).getByRole('tab', { name: 'Mine 1' })).toBeInTheDocument()
    expect(within(views).getByRole('tab', { name: 'Unassigned 1' })).toBeInTheDocument()

    await userEvent.click(within(views).getByRole('tab', { name: /Mine/ }))
    expect(['Mia', 'Nia', 'Una', 'Old'].filter(listed)).toEqual(['Mia', 'Old'])

    await userEvent.click(within(views).getByRole('tab', { name: /Unassigned/ }))
    expect(['Mia', 'Nia', 'Una', 'Old'].filter(listed)).toEqual(['Una'])
    expect(localStorage.getItem('inbox-view')).toBe('unassigned')
  })

  it('says so when nothing is assigned to you', async () => {
    localStorage.setItem('inbox-view', 'mine')
    vi.mocked(getConversations).mockResolvedValue([chat('Una', {})])
    renderAt(<ConversationList onSelect={() => {}} />)
    expect(await screen.findByText('Nothing assigned to you.')).toBeInTheDocument()
    expect(listed('Una')).toBe(false)
  })
})
