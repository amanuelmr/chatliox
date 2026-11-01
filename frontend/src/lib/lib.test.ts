import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from './apiError'
import { isImageAttachment, resolveAttachmentUrl } from './attachments'
import { draftProblem, parseOptions, toDraft, type DraftField } from './preChatForm'
import { apiWsUrl } from './ws'

function axiosError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', 'ERR', config, null, { status, statusText: '', headers: {}, config, data })
}

describe('apiWsUrl', () => {
  it('turns the API URL into a websocket URL', () => {
    expect(apiWsUrl('/ws/dashboard')).toBe('wss://api.example.com/ws/dashboard')
  })
})

describe('apiErrorMessage', () => {
  it("uses the API's explanation", () => {
    expect(apiErrorMessage(axiosError(503, { detail: 'Email is off' }), 'fallback')).toBe('Email is off')
  })

  it('falls back for validation lists and non-API errors', () => {
    expect(apiErrorMessage(axiosError(422, { detail: [{ msg: 'bad' }] }), 'fallback')).toBe('fallback')
    expect(apiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
  })
})

describe('attachments', () => {
  it('resolves API-relative paths against the API URL', () => {
    expect(resolveAttachmentUrl('/media/c/f.png')).toBe('https://api.example.com/media/c/f.png')
    expect(resolveAttachmentUrl('https://cdn.example.com/f.png')).toBe('https://cdn.example.com/f.png')
  })

  it('recognises images', () => {
    expect(isImageAttachment('image/png')).toBe(true)
    expect(isImageAttachment('application/pdf')).toBe(false)
    expect(isImageAttachment(null)).toBe(false)
  })
})

describe('pre-chat form drafts', () => {
  const field = (patch: Partial<DraftField>): DraftField => ({
    key: patch.label ?? 'k',
    label: 'Order number',
    type: 'text',
    optionsText: '',
    required: false,
    ...patch,
  })

  it('parses comma separated options', () => {
    expect(parseOptions(' Billing, ,Shipping ,')).toEqual(['Billing', 'Shipping'])
  })

  it('round-trips a saved question', () => {
    const saved = { id: 'abc', label: 'Topic', type: 'select' as const, options: ['A', 'B'], required: true }
    expect(toDraft(saved)).toMatchObject({ key: 'abc', id: 'abc', optionsText: 'A, B', required: true })
  })

  it('accepts a valid form', () => {
    expect(draftProblem([field({}), field({ label: 'Topic', type: 'select', optionsText: 'A, B' })])).toBeNull()
  })

  it('explains what is wrong', () => {
    expect(draftProblem([field({ label: ' ' })])).toBe('Every question needs a label.')
    expect(draftProblem([field({}), field({ label: 'order NUMBER ' })])).toBe('Each question needs a different label.')
    expect(draftProblem([field({ label: 'Topic', type: 'select', optionsText: 'A' })])).toBe(
      '"Topic" needs at least two options.',
    )
    expect(draftProblem([field({ label: 'Topic', type: 'select', optionsText: 'A, A' })])).toBe(
      '"Topic" has a repeated option.',
    )
  })
})
