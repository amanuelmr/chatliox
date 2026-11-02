import type { CannedResponse, MacroActions } from '@/types/cannedResponse'

export const NO_ACTIONS: MacroActions = { add_tags: [], assign: null, resolve: false }

export function hasActions(actions: MacroActions): boolean {
  return actions.add_tags.length > 0 || actions.assign !== null || actions.resolve
}

// "Adds #refund #billing", "Assigns you", "Resolves" — in the order they run.
export function describeActions(actions: MacroActions): string[] {
  const parts: string[] = []
  if (actions.assign === 'me') parts.push('Assigns you')
  if (actions.assign === 'unassign') parts.push('Unassigns')
  if (actions.add_tags.length > 0) parts.push(`Adds ${actions.add_tags.map((t) => `#${t}`).join(' ')}`)
  if (actions.resolve) parts.push('Resolves')
  return parts
}

// The text after "/" while the reply box holds nothing but a slash command, else null.
export function slashQuery(content: string): string | null {
  const match = /^\/(\S*)$/.exec(content)
  return match ? match[1].toLowerCase() : null
}

// Shortcut prefix matches first, then title matches; the most used first within each.
export function matchMacros(macros: CannedResponse[], query: string): CannedResponse[] {
  const q = query.trim().toLowerCase()
  const byUse = (a: CannedResponse, b: CannedResponse) => b.use_count - a.use_count || a.title.localeCompare(b.title)
  if (!q) return [...macros].sort(byUse)
  const shortcut = macros.filter((m) => m.shortcut?.startsWith(q)).sort(byUse)
  const title = macros
    .filter((m) => !shortcut.includes(m) && m.title.toLowerCase().includes(q))
    .sort(byUse)
  return [...shortcut, ...title]
}

// "refund, Billing ,refund" → ["refund", "Billing"]
export function parseTags(text: string): string[] {
  return Array.from(new Set(text.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)))
}
