import type { PreChatField } from '@/types/auth'

// Editing state for one question. `key` keeps React rows stable before the API
// has assigned an id, and options are edited as the comma-separated text typed.
export interface DraftField {
  key: string
  id?: string
  label: string
  type: PreChatField['type']
  optionsText: string
  required: boolean
}

export const toDraft = (field: PreChatField): DraftField => ({
  key: field.id,
  id: field.id,
  label: field.label,
  type: field.type,
  optionsText: field.options.join(', '),
  required: field.required,
})

export const parseOptions = (text: string) =>
  text.split(',').map((o) => o.trim()).filter(Boolean)

export function draftProblem(fields: DraftField[]): string | null {
  const labels = fields.map((f) => f.label.trim().toLowerCase())
  if (labels.some((l) => !l)) return 'Every question needs a label.'
  if (new Set(labels).size !== labels.length) return 'Each question needs a different label.'
  for (const f of fields) {
    if (f.type !== 'select') continue
    const options = parseOptions(f.optionsText)
    if (options.length < 2) return `"${f.label.trim()}" needs at least two options.`
    if (new Set(options).size !== options.length) return `"${f.label.trim()}" has a repeated option.`
  }
  return null
}
