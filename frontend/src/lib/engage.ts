import type { ProactiveMessage } from '@/types/auth'

// What the widget remembers about a visitor between page loads, to decide
// which proactive messages are due. Kept in the widget's own storage.
export interface VisitHistory {
  visits: number
  lastSeen: number
  // Proactive message id → the visit it was shown on.
  shown: Record<string, number>
}

// A visitor returning after this long has started a new visit.
const VISIT_GAP_MS = 30 * 60_000

export function recordVisit(history: VisitHistory | null, now: number): VisitHistory {
  if (!history) return { visits: 1, lastSeen: now, shown: {} }
  const visits = now - history.lastSeen > VISIT_GAP_MS ? history.visits + 1 : history.visits
  return { ...history, visits, lastSeen: now }
}

// The first proactive message that should pop up now, if any.
export function dueProactive(
  messages: ProactiveMessage[],
  { url, secondsOnPage, history }: { url: string; secondsOnPage: number; history: VisitHistory },
): ProactiveMessage | null {
  const page = url.toLowerCase()
  return (
    messages.find((m) => {
      if (!m.enabled || !m.id) return false
      if (m.page_contains && !page.includes(m.page_contains.toLowerCase())) return false
      if (history.visits < m.min_visits || secondsOnPage < m.delay_seconds) return false
      const shownOn = history.shown[m.id]
      return shownOn === undefined || (m.frequency === 'every_visit' && shownOn < history.visits)
    }) ?? null
  )
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

// "On pages containing /pricing, after 10 seconds, from the 2nd visit. Once per visitor."
export function describeTrigger(m: ProactiveMessage): string {
  const where = m.page_contains ? `On pages containing ${m.page_contains}` : 'On any page'
  const when = m.delay_seconds === 0 ? 'right away' : `after ${m.delay_seconds} second${m.delay_seconds === 1 ? '' : 's'}`
  const visits = m.min_visits > 1 ? `, from the ${ordinal(m.min_visits)} visit` : ''
  const often = m.frequency === 'once' ? 'Once per visitor.' : 'Once every visit.'
  return `${where}, ${when}${visits}. ${often}`
}

export const NEW_PROACTIVE: ProactiveMessage = {
  message: '',
  page_contains: '',
  delay_seconds: 10,
  min_visits: 1,
  frequency: 'once',
  enabled: true,
}
