import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCannedResponse, getCannedResponses, updateCannedResponse } from '@/api/cannedResponses'
import { renderAt } from '@/test/render'
import type { CannedResponse } from '@/types/cannedResponse'
import SavedRepliesCard from './SavedRepliesCard'

vi.mock('@/api/cannedResponses', () => ({
  getCannedResponses: vi.fn(),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
}))

const existing: CannedResponse = {
  id: 'r1',
  title: 'Refund policy',
  content: 'Refunds take 5 days.',
  shortcut: 'refund',
  actions: { add_tags: ['refund'], assign: 'me', resolve: false },
  use_count: 3,
  created_at: '',
}

describe('saved replies settings', () => {
  beforeEach(() => {
    vi.mocked(getCannedResponses).mockResolvedValue([existing])
    vi.mocked(createCannedResponse).mockResolvedValue(existing)
    vi.mocked(updateCannedResponse).mockResolvedValue(existing)
  })

  it('lists each reply with its shortcut, actions and use count', async () => {
    renderAt(<SavedRepliesCard />)
    expect(await screen.findByText('/refund')).toBeInTheDocument()
    expect(screen.getByText('⚡ Assigns you · Adds #refund')).toBeInTheDocument()
    expect(screen.getByText('Used 3 times')).toBeInTheDocument()
  })

  it('adds an actions-only macro with a normalised shortcut', async () => {
    renderAt(<SavedRepliesCard />)
    await userEvent.type(screen.getByLabelText('Title'), 'Spam')
    expect(screen.getByText('Add reply text or at least one action.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add saved reply' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Shortcut'), '/Spam')
    await userEvent.type(screen.getByPlaceholderText('refund, billing'), 'spam, #junk')
    await userEvent.click(screen.getByLabelText('Resolve the chat'))
    await userEvent.click(screen.getByRole('button', { name: 'Add saved reply' }))

    expect(vi.mocked(createCannedResponse).mock.calls[0][0]).toEqual({
      title: 'Spam',
      content: '',
      shortcut: 'spam',
      actions: { add_tags: ['spam', 'junk'], assign: null, resolve: true },
    })
  })

  it('rejects a shortcut with spaces', async () => {
    renderAt(<SavedRepliesCard />)
    await userEvent.type(screen.getByLabelText('Title'), 'Hello')
    await userEvent.type(screen.getByLabelText('Reply text'), 'Hi!')
    await userEvent.type(screen.getByLabelText('Shortcut'), 'say hi')
    expect(screen.getByText('Shortcuts use lowercase letters, numbers and dashes.')).toBeInTheDocument()
  })

  it('edits an existing reply in place', async () => {
    renderAt(<SavedRepliesCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Refund policy')
    expect(screen.getByLabelText('Shortcut')).toHaveValue('refund')

    await userEvent.selectOptions(screen.getByRole('combobox'), 'unassign')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(vi.mocked(updateCannedResponse).mock.calls[0]).toEqual([
      'r1',
      {
        title: 'Refund policy',
        content: 'Refunds take 5 days.',
        shortcut: 'refund',
        actions: { add_tags: ['refund'], assign: 'unassign', resolve: false },
      },
    ])
  })
})
