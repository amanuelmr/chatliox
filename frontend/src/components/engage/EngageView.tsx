import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { SaveBar } from './EditorParts'
import ProactiveEditor, { proactiveProblem, useProactiveDraft } from './ProactiveEditor'
import WelcomeEditor, { useWelcomeDraft } from './WelcomeEditor'
import WidgetPreview, { type PreviewState } from './WidgetPreview'

type Tab = 'welcome' | 'proactive'

const TABS: { id: Tab; label: string; preview: PreviewState }[] = [
  { id: 'welcome', label: 'Welcome', preview: 'open' },
  { id: 'proactive', label: 'Proactive messages', preview: 'closed' },
]

// Everything visitors see from the widget before they ask a question, with a
// preview that follows the edits as they're made.
export default function EngageView() {
  const org = useAuthStore((s) => s.user?.organization)
  const [tab, setTab] = useState<Tab>('welcome')
  const [previewState, setPreviewState] = useState<PreviewState>('open')
  const [selectedProactive, setSelectedProactive] = useState(0)
  const welcome = useWelcomeDraft()
  const proactive = useProactiveDraft()

  if (!org) return null
  const active = tab === 'welcome' ? welcome : proactive
  const problem = tab === 'proactive' ? proactiveProblem(proactive.draft) : null

  const shown = proactive.draft[selectedProactive]
  const welcomeMessages = welcome.draft.welcome_messages.filter((m) => m.trim())
  // Opening the chat from a proactive message adds it to the greeting.
  const greeting = tab === 'proactive' && shown?.message.trim() ? [...welcomeMessages, shown.message] : welcomeMessages
  const pagePath = tab === 'proactive' && shown?.page_contains ? shown.page_contains.replace(/^\/?/, '') : ''

  const switchTab = (next: (typeof TABS)[number]) => {
    setTab(next.id)
    setPreviewState(next.preview)
  }

  return (
    <main className="flex-1 bg-zinc-100 overflow-auto">
      <div className="max-w-6xl mx-auto py-10 px-6 flex flex-col gap-6">
        <header>
          <h1 className="font-display text-2xl font-semibold text-zinc-900 tracking-tight">Engage</h1>
          <p className="text-sm text-zinc-500 mt-1">What visitors see from your widget before they ask anything.</p>
        </header>

        <div className="flex gap-1 border-b border-zinc-200" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => switchTab(t)}
              className={`text-sm px-3 py-2 -mb-px border-b-2 transition-colors ${
                tab === t.id ? 'border-brand-500 text-zinc-900 font-semibold' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
              {/* Unsaved edits on a tab you've left are easy to forget. */}
              {(t.id === 'welcome' ? welcome : proactive).dirty && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" aria-label="unsaved" />
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 px-6 pt-6" role="tabpanel">
            {tab === 'welcome' ? (
              <WelcomeEditor state={welcome} />
            ) : (
              <ProactiveEditor state={proactive} selected={selectedProactive} onSelect={setSelectedProactive} />
            )}
            <SaveBar
              dirty={active.dirty}
              saving={active.saving}
              saved={active.saved}
              error={active.error}
              onSave={active.save}
              onDiscard={active.discard}
              problem={problem}
            />
          </div>

          <aside className="lg:sticky lg:top-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Preview</p>
              <div className="flex bg-zinc-200/70 rounded-lg p-0.5 text-xs" role="group" aria-label="Preview the widget">
                {(['closed', 'open'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={previewState === s}
                    onClick={() => setPreviewState(s)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize ${
                      previewState === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <WidgetPreview
              brandColor={org.widget_color}
              teamName={org.name}
              greeting={org.widget_greeting}
              position={org.widget_position === 'left' ? 'left' : 'right'}
              replyWithinMinutes={org.first_response_minutes}
              welcomeMessages={greeting}
              quickReplies={welcome.draft.quick_replies}
              state={previewState}
              teaser={tab === 'proactive' && shown?.enabled ? shown.message.trim() || null : null}
              pageUrl={`https://${org.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com/${pagePath}`}
            />
            {tab === 'proactive' && shown && !shown.enabled && (
              <p className="text-xs text-zinc-500">This message is switched off, so visitors won't see it.</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
