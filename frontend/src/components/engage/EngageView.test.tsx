import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateWelcome } from '@/api/organizations'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { Organization, User } from '@/types/auth'
import EngageView from './EngageView'

vi.mock('@/api/organizations', () => ({
  updateWelcome: vi.fn(),
  updateProactiveMessages: vi.fn(),
  updateDisplayRules: vi.fn(),
  getProactiveStats: vi.fn().mockResolvedValue([]),
}))

const ORG = {
  name: 'Boot Shop',
  widget_color: '#4f6ef7',
  widget_greeting: 'Hi from the shop',
  widget_position: 'right',
  first_response_minutes: null,
  welcome_messages: ['Hi there!'],
  quick_replies: [],
  proactive_messages: [],
  widget_devices: 'all',
  widget_hidden_paths: [],
  widget_allowed_domains: [],
} as unknown as Organization

function signIn(org: Partial<Organization> = {}) {
  useAuthStore.getState().setAuth('token', { id: 'me', role: 'admin', organization: { ...ORG, ...org } } as User)
}

const preview = () => within(screen.getByRole('figure', { name: 'Widget preview' }))

describe('engage: welcome', () => {
  beforeEach(() => {
    vi.mocked(updateWelcome).mockReset()
    signIn()
  })

  it('previews welcome messages and quick replies as they are edited, then saves them', async () => {
    renderAt(<EngageView />)
    expect(preview().getByText('Hi there!')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Add a message' }))
    // The new row has the focus, so typing goes straight in.
    await userEvent.keyboard('Need a hand with sizing?')
    expect(preview().getByText('Need a hand with sizing?')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Quick replies' }), 'Track my order{Enter}')
    expect(preview().getByRole('button', { name: 'Track my order' })).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes. Visitors still see the saved version.')).toBeInTheDocument()

    vi.mocked(updateWelcome).mockResolvedValue({
      ...ORG,
      welcome_messages: ['Hi there!', 'Need a hand with sizing?'],
      quick_replies: ['Track my order'],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(updateWelcome).toHaveBeenCalledWith({
      welcome_messages: ['Hi there!', 'Need a hand with sizing?'],
      quick_replies: ['Track my order'],
    })
    expect(await screen.findByText('Saved. Visitors see this on their next page load.')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.organization.quick_replies).toEqual(['Track my order'])
  })

  it('throws away unsaved edits', async () => {
    renderAt(<EngageView />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove welcome message 1' }))
    expect(preview().queryByText('Hi there!')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(preview().getByText('Hi there!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})
