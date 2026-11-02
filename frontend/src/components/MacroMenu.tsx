import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCannedResponses } from '@/api/cannedResponses'
import { describeActions, matchMacros } from '@/lib/macros'
import type { CannedResponse } from '@/types/cannedResponse'

// The list of saved replies, shared by the "/" picker and the toolbar button.
export function MacroList({
  macros,
  highlight,
  onPick,
  onHighlight,
  empty,
}: {
  macros: CannedResponse[]
  highlight?: number
  onPick: (macro: CannedResponse) => void
  onHighlight?: (index: number) => void
  empty: string
}) {
  const activeRef = useRef<HTMLLIElement>(null)
  // A block body: newer browsers return a Promise from scrollIntoView, which React would take for a cleanup.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  if (macros.length === 0) return <p className="text-xs text-zinc-400 text-center py-6 px-4">{empty}</p>
  return (
    <ul role="listbox" aria-label="Saved replies" className="divide-y divide-zinc-100">
      {macros.map((m, i) => {
        const actions = describeActions(m.actions)
        return (
          <li key={m.id} ref={i === highlight ? activeRef : undefined} role="option" aria-selected={i === highlight}>
            <button
              type="button"
              // Keep focus in the reply box so typing carries on.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(m)}
              onMouseEnter={() => onHighlight?.(i)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${i === highlight ? 'bg-brand-50' : 'hover:bg-zinc-50'}`}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                <span className="truncate">{m.title}</span>
                {m.shortcut && <span className="flex-shrink-0 font-mono font-medium text-zinc-400">/{m.shortcut}</span>}
              </p>
              {m.content && <p className="text-xs text-zinc-400 truncate">{m.content}</p>}
              {actions.length > 0 && (
                <p className="text-[11px] text-brand-600 font-medium truncate mt-0.5">⚡ {actions.join(' · ')}</p>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// The toolbar button that opens every saved reply, most used first.
export function MacroPickerButton({ disabled, onPick }: { disabled: boolean; onPick: (macro: CannedResponse) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: macros = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: getCannedResponses,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Insert saved reply (or type /)"
        className="w-10 h-[46px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all duration-150 disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-72 overflow-y-auto bg-white rounded-xl shadow-lg ring-1 ring-zinc-200 z-10">
          <MacroList
            macros={matchMacros(macros, '')}
            onPick={(m) => { onPick(m); setOpen(false) }}
            empty="No saved replies yet. Add some in Settings."
          />
        </div>
      )}
    </div>
  )
}
