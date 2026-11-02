import { updateWelcome } from '@/api/organizations'
import { EditorSection, FIELD_CLASS, TokenInput } from './EditorParts'
import { useOrgDraft } from './useOrgDraft'

export interface WelcomeDraft {
  welcome_messages: string[]
  quick_replies: string[]
}

const MAX_MESSAGES = 3

export function useWelcomeDraft() {
  return useOrgDraft<WelcomeDraft>(
    (org) => ({ welcome_messages: org.welcome_messages ?? [], quick_replies: org.quick_replies ?? [] }),
    // Blank bubbles are left out rather than rejected.
    (draft) => updateWelcome({ ...draft, welcome_messages: draft.welcome_messages.filter((m) => m.trim()) }),
  )
}

export default function WelcomeEditor({ state }: { state: ReturnType<typeof useWelcomeDraft> }) {
  const { draft, setDraft } = state
  const messages = draft.welcome_messages
  const setMessages = (welcome_messages: string[]) => setDraft({ ...draft, welcome_messages })

  return (
    <>
      <EditorSection
        title="Welcome messages"
        hint="Sent from your team as separate bubbles when a visitor opens the chat, before they type anything. Keep each one short."
      >
        <ol className="flex flex-col gap-2">
          {messages.map((message, i) => (
            <li key={i} className="flex items-start gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessages(messages.map((m, j) => (j === i ? e.target.value : m)))}
                rows={2}
                maxLength={300}
                // A row just added with "Add a message" is ready to type in.
                autoFocus={i === messages.length - 1 && message === ''}
                aria-label={`Welcome message ${i + 1}`}
                placeholder={i === 0 ? 'Hi there! 👋' : 'Ask us anything about orders, sizing or returns.'}
                className={`${FIELD_CLASS} resize-none`}
              />
              <button
                type="button"
                onClick={() => setMessages(messages.filter((_, j) => j !== i))}
                aria-label={`Remove welcome message ${i + 1}`}
                className="mt-1.5 w-7 h-7 flex-shrink-0 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        {messages.length < MAX_MESSAGES && (
          <button
            type="button"
            onClick={() => setMessages([...messages, ''])}
            className="self-start text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            + Add a message
          </button>
        )}
      </EditorSection>

      <EditorSection
        title="Quick replies"
        hint="Buttons the visitor can tap instead of typing. Tapping one sends it as their first message."
      >
        <TokenInput
          label="Quick replies"
          values={draft.quick_replies}
          onChange={(quick_replies) => setDraft({ ...draft, quick_replies })}
          max={4}
          maxLength={40}
          placeholder="Type a reply and press Enter, e.g. Where's my order?"
        />
      </EditorSection>
    </>
  )
}
