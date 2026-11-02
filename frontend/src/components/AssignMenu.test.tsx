import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignConversation } from '@/api/conversations'
import { getTeammates } from '@/api/organizations'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { User } from '@/types/auth'
import type { Conversation } from '@/types/chat'
import AssignMenu from './AssignMenu'

vi.mock('@/api/conversations', () => ({ assignConversation: vi.fn() }))
vi.mock('@/api/organizations', () => ({ getTeammates: vi.fn() }))

const conv = (patch: Partial<Conversation> = {}) =>
  ({ id: 'c1', assigned_to_id: null, assigned_to_name: null, ...patch }) as Conversation

describe('assign menu', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth('token', { id: 'me', full_name: 'Wes' } as User)
    vi.mocked(getTeammates).mockResolvedValue([
      { id: 'ana', full_name: 'Ana' },
      { id: 'sam', full_name: 'Sam' },
      { id: 'me', full_name: 'Wes' },
    ])
    vi.mocked(assignConversation).mockResolvedValue(conv())
  })

  it('lists you first and hands the chat over with a note', async () => {
    renderAt(<AssignMenu conversation={conv({ assigned_to_id: 'ana', assigned_to_name: 'Ana' })} />)
    await userEvent.click(screen.getByRole('button', { name: /Assigned to Ana/ }))

    const items = await screen.findAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual(['Me (Wes)', 'AnaCurrent', 'Sam', 'Unassign'])
    expect(items[1]).toBeDisabled()

    await userEvent.click(items[2])
    expect(screen.getByText('Assign to Sam?')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Handover note'), 'Billing question')
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }))
    expect(assignConversation).toHaveBeenCalledWith('c1', 'sam', 'Billing question')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('unassigns, and offers no unassign on an unassigned chat', async () => {
    renderAt(<AssignMenu conversation={conv({ assigned_to_id: 'me', assigned_to_name: 'Wes' })} />)
    await userEvent.click(screen.getByRole('button', { name: /Assigned to you/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unassign' }))
    await userEvent.click(screen.getByRole('button', { name: 'Unassign' }))
    expect(assignConversation).toHaveBeenCalledWith('c1', null, '')
  })

  it('has nothing to release when nobody owns the chat', async () => {
    renderAt(<AssignMenu conversation={conv()} />)
    await userEvent.click(screen.getByRole('button', { name: /Unassigned/ }))
    await screen.findAllByRole('menuitem')
    expect(screen.queryByRole('menuitem', { name: 'Unassign' })).not.toBeInTheDocument()
  })
})
