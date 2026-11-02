import type { ReactNode } from 'react'
import { apiErrorMessage } from '@/lib/apiError'

export function EditorSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="py-6 first:pt-0 border-b border-zinc-100 last:border-0 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">{hint}</p>
      </div>
      {children}
    </section>
  )
}

// Save and discard for one tab's settings, kept in view at the bottom of the editor.
export function SaveBar({
  dirty,
  saving,
  saved,
  error,
  onSave,
  onDiscard,
  problem,
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  error: unknown
  onSave: () => void
  onDiscard: () => void
  // Why the draft can't be saved yet, if it can't.
  problem?: string | null
}) {
  return (
    <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white/95 backdrop-blur border-t border-zinc-100 flex items-center gap-3">
      <p className="text-xs flex-1 min-w-0" role="status">
        {error ? (
          <span className="text-red-600">{apiErrorMessage(error, "Couldn't save. Please try again.")}</span>
        ) : problem ? (
          <span className="text-amber-700">{problem}</span>
        ) : dirty ? (
          <span className="text-zinc-500">Unsaved changes. Visitors still see the saved version.</span>
        ) : saved ? (
          <span className="text-emerald-700">Saved. Visitors see this on their next page load.</span>
        ) : null}
      </p>
      {dirty && (
        <button type="button" onClick={onDiscard} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-2 py-1.5">
          Discard
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving || Boolean(problem)}
        className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-3.5 py-2 transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

export const FIELD_CLASS =
  'w-full text-sm bg-zinc-50 rounded-lg px-3 py-2 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-150'

// Short strings entered one at a time: quick replies, page patterns, domains.
export function TokenInput({
  values,
  onChange,
  max,
  maxLength,
  placeholder,
  label,
  normalize = (v) => v.trim(),
}: {
  values: string[]
  onChange: (values: string[]) => void
  max: number
  maxLength: number
  placeholder: string
  label: string
  normalize?: (value: string) => string
}) {
  const add = (raw: string) => {
    const value = normalize(raw)
    if (!value || values.includes(value) || values.length >= max) return false
    onChange([...values, value])
    return true
  }
  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {values.map((value) => (
            <li key={value} className="inline-flex items-center gap-1 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-full pl-2.5 pr-1 py-1">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="w-4 h-4 rounded-full text-zinc-400 hover:text-red-600 hover:bg-white leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {values.length < max ? (
        <input
          type="text"
          aria-label={label}
          placeholder={placeholder}
          maxLength={maxLength}
          className={FIELD_CLASS}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (add(e.currentTarget.value)) e.currentTarget.value = ''
          }}
          onBlur={(e) => {
            if (add(e.currentTarget.value)) e.currentTarget.value = ''
          }}
        />
      ) : (
        <p className="text-xs text-zinc-400">That's the most you can add ({max}).</p>
      )}
    </div>
  )
}
