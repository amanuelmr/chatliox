import { useCallback, useEffect, useState } from 'react'
import { dueProactive, recordVisit, type VisitHistory } from '@/lib/engage'
import { LOADER_MSG_SOURCE } from '@/lib/embed'
import type { ProactiveMessage } from '@/types/auth'

export interface HostPage {
  url: string
  // When the visitor arrived on it.
  since: number
}

// The page of the customer's site the widget is on, as the loader reports it.
export function useHostPage(enabled: boolean): HostPage | null {
  const [page, setPage] = useState<HostPage | null>(null)
  useEffect(() => {
    if (!enabled) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as { source?: string; type?: string; url?: unknown } | null
      if (!data || data.source !== LOADER_MSG_SOURCE || data.type !== 'page' || typeof data.url !== 'string') return
      const url = data.url
      setPage((prev) => (prev?.url === url ? prev : { url, since: Date.now() }))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [enabled])
  return page
}

function load(key: string): VisitHistory | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as VisitHistory) : null
  } catch {
    return null
  }
}

function save(key: string, history: VisitHistory) {
  try {
    localStorage.setItem(key, JSON.stringify(history))
  } catch {
    // Without storage the visitor may see a message again; nothing else breaks.
  }
}

// Picks the team's proactive message for this visitor once its conditions are
// met, and remembers it was shown so the frequency limit holds across pages.
export function useProactiveMessage(
  widgetKey: string,
  messages: ProactiveMessage[],
  page: HostPage | null,
  active: boolean,
) {
  const storageKey = `chatliox_engagement_${widgetKey}`
  const [current, setCurrent] = useState<ProactiveMessage | null>(null)

  useEffect(() => {
    if (page) save(storageKey, recordVisit(load(storageKey), Date.now()))
  }, [page, storageKey])

  useEffect(() => {
    if (!active || !page || current || messages.length === 0) return
    const check = () => {
      const history = load(storageKey) ?? recordVisit(null, Date.now())
      const due = dueProactive(messages, { url: page.url, secondsOnPage: (Date.now() - page.since) / 1000, history })
      if (!due?.id) return
      save(storageKey, { ...history, shown: { ...history.shown, [due.id]: history.visits } })
      setCurrent(due)
    }
    check()
    const timer = setInterval(check, 1_000)
    return () => clearInterval(timer)
  }, [active, page, current, messages, storageKey])

  const dismiss = useCallback(() => setCurrent(null), [])
  return { proactive: current, dismiss }
}
