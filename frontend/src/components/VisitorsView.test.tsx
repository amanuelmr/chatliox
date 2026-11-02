import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getConversations } from '@/api/conversations'
import { getLiveVisitors } from '@/api/visitors'
import { renderAt } from '@/test/render'
import type { Conversation } from '@/types/chat'
import type { LiveVisitor } from '@/types/visitor'
import VisitorsView from './VisitorsView'

vi.mock('@/api/conversations', () => ({ getConversations: vi.fn() }))
vi.mock('@/api/visitors', () => ({ getLiveVisitors: vi.fn() }))

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const visitor = (visitor_id: string, minutes: number, patch: Partial<LiveVisitor> = {}): LiveVisitor => ({
  visitor_id,
  arrived_at: minutesAgo(minutes),
  user_agent: null,
  referrer: null,
  pages: [{ url: 'https://shop.test/', title: 'Shop', at: minutesAgo(minutes) }],
  ...patch,
})

describe('live visitors', () => {
  it('lists who is on the site, newest first, with their chat if they have one', async () => {
    vi.mocked(getLiveVisitors).mockResolvedValue([
      visitor('vera-id', 75, {
        referrer: 'https://www.search.test/?q=boots',
        pages: [
          { url: 'https://shop.test/', title: 'Shop', at: minutesAgo(75) },
          { url: 'https://shop.test/checkout', title: 'Checkout', at: minutesAgo(2) },
        ],
      }),
      visitor('a1b2c3d4-anon', 0),
    ])
    vi.mocked(getConversations).mockResolvedValue([
      { id: 'old', visitor_id: 'vera-id', visitor_name: 'Vera', status: 'closed', created_at: minutesAgo(600) },
      { id: 'c1', visitor_id: 'vera-id', visitor_name: 'Vera', status: 'waiting', created_at: minutesAgo(5) },
    ] as Conversation[])
    const onOpenChat = vi.fn()
    renderAt(<VisitorsView onOpenChat={onOpenChat} />)

    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(screen.getByText('2 now')).toBeInTheDocument()

    const anon = within(rows[0])
    expect(anon.getByText('Visitor a1b2c3')).toBeInTheDocument()
    expect(anon.getByText('Just now')).toBeInTheDocument()
    expect(anon.getByText('Direct')).toBeInTheDocument()
    expect(anon.getByText('No chat')).toBeInTheDocument()

    const vera = within(rows[1])
    expect(vera.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', 'https://shop.test/checkout')
    expect(vera.getByText('1h 15m')).toBeInTheDocument()
    expect(vera.getByText('search.test')).toBeInTheDocument()
    // The latest chat, not the one they had last week.
    await userEvent.click(vera.getByRole('button', { name: 'Open chat with Vera' }))
    expect(onOpenChat).toHaveBeenCalledWith('c1')
  })

  it('says so when nobody is around', async () => {
    vi.mocked(getLiveVisitors).mockResolvedValue([])
    vi.mocked(getConversations).mockResolvedValue([])
    renderAt(<VisitorsView onOpenChat={vi.fn()} />)
    expect(await screen.findByText('Nobody is on your site right now.')).toBeInTheDocument()
  })
})
