import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from './apiError'
import { isImageAttachment, resolveAttachmentUrl } from './attachments'
import { describeActions, matchMacros, parseTags, slashQuery } from './macros'
import { draftProblem, parseOptions, toDraft, type DraftField } from './preChatForm'
import { formatMinutes, responseClock } from './responseTime'
import { listNames } from './teammates'
import { describeBrowser, pageLabel, pagePath, siteName } from './visitor'
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

describe('listNames', () => {
  it('reads naturally for any number of teammates', () => {
    expect(listNames(['Sam'])).toBe('Sam')
    expect(listNames(['Sam', 'Ana'])).toBe('Sam and Ana')
    expect(listNames(['Sam', 'Ana', 'Lee'])).toBe('Sam, Ana and Lee')
    expect(listNames(['Sam', 'Ana', 'Lee', 'Bo'])).toBe('Sam, Ana and 2 others')
  })
})

describe('formatMinutes', () => {
  it('spells out minutes and hours', () => {
    expect(formatMinutes(1)).toBe('1 minute')
    expect(formatMinutes(15)).toBe('15 minutes')
    expect(formatMinutes(60)).toBe('1 hour')
    expect(formatMinutes(90)).toBe('1 hour 30 minutes')
    expect(formatMinutes(120)).toBe('2 hours')
  })
})

describe('responseClock', () => {
  const start = '2026-11-02T10:00:00Z'
  const at = (minutes: number) => new Date(start).getTime() + minutes * 60_000

  it('counts down to the target, then up past it', () => {
    expect(responseClock(start, 10, at(2))).toEqual({ overdue: false, urgent: false, label: '8m left' })
    expect(responseClock(start, 10, at(8.5))).toEqual({ overdue: false, urgent: true, label: '2m left' })
    expect(responseClock(start, 10, at(25))).toEqual({ overdue: true, urgent: true, label: '15m overdue' })
    expect(responseClock(start, 10, at(100)).label).toBe('1h 30m overdue')
  })
})

describe('saved reply helpers', () => {
  const macro = (title: string, shortcut: string | null, use_count = 0) => ({
    id: title,
    title,
    content: '',
    shortcut,
    use_count,
    created_at: '',
    actions: { add_tags: [], assign: null, resolve: false },
  })

  it('reads a slash command only while it is all the reply box holds', () => {
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('/Ref')).toBe('ref')
    expect(slashQuery('/ref more')).toBeNull()
    expect(slashQuery('hi /ref')).toBeNull()
  })

  it('ranks shortcut matches over title matches, most used first', () => {
    const list = [macro('Refund policy', 'refund', 1), macro('Late refund', 'late', 9), macro('Return label', 'ret', 5)]
    expect(matchMacros(list, 're').map((m) => m.title)).toEqual(['Return label', 'Refund policy', 'Late refund'])
    expect(matchMacros(list, '').map((m) => m.title)).toEqual(['Late refund', 'Return label', 'Refund policy'])
    expect(matchMacros(list, 'zzz')).toEqual([])
  })

  it('describes actions in the order they run', () => {
    expect(describeActions({ add_tags: ['refund', 'billing'], assign: 'me', resolve: true })).toEqual([
      'Assigns you',
      'Adds #refund #billing',
      'Resolves',
    ])
    expect(describeActions({ add_tags: [], assign: null, resolve: false })).toEqual([])
  })

  it('parses a tag list', () => {
    expect(parseTags(' refund, #billing,, refund ')).toEqual(['refund', 'billing'])
  })
})

describe('visitor details', () => {
  const UA = {
    chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68',
    safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
    chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  }

  it('names the browser and system from a user agent', () => {
    expect(describeBrowser(UA.chromeMac)).toBe('Chrome 130 on macOS')
    expect(describeBrowser(UA.edgeWindows)).toBe('Edge 130 on Windows')
    expect(describeBrowser(UA.safariIphone)).toBe('Safari 18 on iOS')
    expect(describeBrowser(UA.firefoxAndroid)).toBe('Firefox 132 on Android')
    expect(describeBrowser(UA.chromeIphone)).toBe('Chrome 130 on iOS')
    expect(describeBrowser('curl/8.7.1')).toBeNull()
    expect(describeBrowser(null)).toBeNull()
  })

  it('labels pages and sites', () => {
    expect(pagePath('https://shop.test/boots?size=9#reviews')).toBe('/boots?size=9#reviews')
    expect(pageLabel({ url: 'https://shop.test/boots', title: '', at: '' })).toBe('/boots')
    expect(pageLabel({ url: 'https://shop.test/boots', title: 'Boots', at: '' })).toBe('Boots')
    expect(siteName('https://www.search.test/?q=1')).toBe('search.test')
    expect(siteName('not a url')).toBe('not a url')
  })
})
