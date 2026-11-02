import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applyMacro, getCannedResponses } from '@/api/cannedResponses'
import { emailTranscript, getConversations, updateConversationStatus, updateConversationTags } from '@/api/conversations'
import { getMessages, sendMessage, uploadAttachment } from '@/api/messages'
import { isImageAttachment, resolveAttachmentUrl } from '@/lib/attachments'
import { describeActions, hasActions, matchMacros, slashQuery } from '@/lib/macros'
import { listNames } from '@/lib/teammates'
import { describeBrowser, pageLabel, siteName } from '@/lib/visitor'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import AssignMenu from '@/components/AssignMenu'
import { MacroList, MacroPickerButton } from '@/components/MacroMenu'
import PageTrail from '@/components/PageTrail'
import { useLiveVisitors } from '@/components/VisitorsView'
import Spinner from '@/components/Spinner'
import { apiErrorMessage } from '@/lib/apiError'
import { apiWsUrl } from '@/lib/ws'
import type { CannedResponse } from '@/types/cannedResponse'
import type { Conversation, ConversationStatus, Message, WsEvent } from '@/types/chat'

type InputMode = 'reply' | 'note'

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function visitorLabel(c: Conversation) {
  return c.visitor_name ?? c.visitor_email ?? 'Anonymous visitor'
}

export default function AdminChatWindow({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const user  = useAuthStore((s) => s.user)
  const { setOnline, setOffline, setTyping, setViewers, typing, viewers, clear: clearPresence } = usePresenceStore()
  const otherViewers = viewers.filter((v) => v.user_id !== user?.id).map((v) => v.name)
  const visitor = [...typing.values()].find((t) => t.sender_type !== 'admin')
  const visitorTyping = visitor !== undefined
  const visitorDraft = visitor?.draft?.trim() ? visitor.draft : null
  const hasDraft = visitorDraft !== null
  const teammatesTyping = [...typing]
    .filter(([id, t]) => t.sender_type === 'admin' && id !== user?.id)
    .map(([, t]) => t.name ?? 'A teammate')

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState('')
  // The saved reply picked for this message; sending runs its actions too.
  const [macro, setMacro] = useState<CannedResponse | null>(null)
  const [highlight, setHighlight] = useState(0)
  const [mode, setMode] = useState<InputMode>('reply')
  const [connected, setConnected] = useState(false)

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
  })
  const conv = conversations.find((c) => c.id === conversationId)
  const resolved = conv?.status === 'closed'
  const { data: liveVisitors = [] } = useLiveVisitors()
  const live = conv && liveVisitors.find((v) => v.visitor_id === conv.visitor_id)
  const livePage = live?.pages[live.pages.length - 1]

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
  })

  // Also when a typing preview appears, so it isn't hidden below the fold.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, hasDraft])

  const appendMsg = useCallback((msg: Message) => {
    queryClient.setQueryData<Message[]>(['messages', conversationId], (prev = []) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
    )
  }, [queryClient, conversationId])

  useEffect(() => {
    clearPresence()
    let active = true
    let retry: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      wsRef.current?.close()
      const ws = new WebSocket(apiWsUrl(`/ws/conversations/${conversationId}?token=${token ?? ''}`))
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onmessage = ({ data }: MessageEvent) => {
        try {
          const e = JSON.parse(data as string) as WsEvent
          if (e.type === 'message') { appendMsg(e); queryClient.invalidateQueries({ queryKey: ['conversations'] }) }
          else if (e.type === 'typing') setTyping(e)
          else if (e.type === 'viewers') setViewers(e.agents)
          else if (e.type === 'presence') e.status === 'online' ? setOnline(e.user_id) : setOffline(e.user_id)
        } catch { /* ignore */ }
      }
      ws.onclose = () => { setConnected(false); if (active) retry = setTimeout(connect, 2_000) }
    }
    connect()
    return () => {
      active = false
      if (retry) clearTimeout(retry)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      wsRef.current?.close()
      wsRef.current = null
      clearPresence()
    }
  }, [conversationId, appendMsg, queryClient, token, setOnline, setOffline, setTyping, setViewers, clearPresence])

  const sendTyping = useCallback((v: boolean) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: v }))
  }, [])

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    if (mode === 'reply') {
      sendTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => sendTyping(false), 2_000)
    }
  }

  const { mutate: send, isPending } = useMutation({
    mutationFn: sendMessage,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })
      const prev = queryClient.getQueryData<Message[]>(['messages', conversationId]) ?? []
      const tempId = `opt-${Date.now()}`
      queryClient.setQueryData<Message[]>(['messages', conversationId], [
        ...prev,
        {
          id: tempId,
          conversation_id: conversationId,
          content: vars.content,
          sender_type: 'admin',
          sender_id: null,
          sender_name: user?.full_name ?? null,
          is_read: true,
          is_internal: vars.is_internal ?? false,
          created_at: new Date().toISOString(),
          attachment_url: null,
          attachment_name: null,
          attachment_mime: null,
        },
      ])
      return { prev, tempId }
    },
    onSuccess: (real, _, ctx) => {
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (msgs = []) => msgs.map((m) => (m.id === ctx?.tempId ? real : m)),
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (_, vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['messages', conversationId], ctx.prev)
      setContent(vars.content)
    },
  })

  const { data: macros = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: getCannedResponses,
  })
  const query = mode === 'reply' && !macro ? slashQuery(content) : null
  const matches = query === null ? [] : matchMacros(macros, query)
  useEffect(() => {
    setHighlight(0)
  }, [query])

  // Macros send a public reply, so they don't apply to internal notes.
  useEffect(() => { if (mode === 'note') setMacro(null) }, [mode])

  // Each conversation starts with an empty reply box.
  useEffect(() => { setMacro(null); setContent('') }, [conversationId])

  const pickMacro = (m: CannedResponse) => {
    setMode('reply')
    setMacro(m)
    // A "/command" is replaced by the reply; other text is kept and the reply added below.
    setContent((prev) => (slashQuery(prev) !== null || !prev.trim() ? m.content : m.content ? `${prev}\n${m.content}` : prev))
  }

  const {
    mutate: runMacro,
    isPending: runningMacro,
    error: macroError,
    reset: resetMacroError,
  } = useMutation({
    mutationFn: ({ macro, text }: { macro: CannedResponse; text: string }) => applyMacro(macro.id, conversationId, text),
    onSuccess: ({ conversation, message }) => {
      if (message) appendMsg(message)
      queryClient.setQueryData<Conversation[]>(['conversations'], (convs = []) =>
        convs.map((c) => (c.id === conversation.id ? conversation : c)),
      )
      // Assignment notes and the use count changed too.
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      setMacro(null)
      setContent('')
    },
  })

  const {
    mutate: sendTranscript,
    isPending: sendingTranscript,
    isSuccess: transcriptSent,
    error: transcriptError,
    reset: resetTranscript,
  } = useMutation({ mutationFn: () => emailTranscript(conversationId) })

  // Each conversation starts with a fresh "Email transcript" action.
  useEffect(() => resetTranscript(), [conversationId, resetTranscript])

  const { mutate: resolve, isPending: resolving } = useMutation({
    mutationFn: () => updateConversationStatus(conversationId, 'closed'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      const prev = queryClient.getQueryData<Conversation[]>(['conversations'])
      queryClient.setQueryData<Conversation[]>(['conversations'], (convs = []) =>
        convs.map((c) => (c.id === conversationId ? { ...c, status: 'closed' as ConversationStatus } : c)),
      )
      return { prev }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    onError: (_, __, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['conversations'], ctx.prev)
    },
  })

  const { mutate: saveTags } = useMutation({
    mutationFn: (tags: string[]) => updateConversationTags(conversationId, tags),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })
  const [tagInput, setTagInput] = useState('')
  const addTag = (e: FormEvent) => {
    e.preventDefault()
    const tag = tagInput.trim()
    if (!tag || !conv || conv.tags.includes(tag)) { setTagInput(''); return }
    saveTags([...conv.tags, tag])
    setTagInput('')
  }
  const removeTag = (tag: string) => {
    if (!conv) return
    saveTags(conv.tags.filter((t) => t !== tag))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (resolved) return
    if (macro) {
      if (!text && !hasActions(macro.actions)) return
      if (typingTimer.current) clearTimeout(typingTimer.current)
      sendTyping(false)
      runMacro({ macro, text })
      return
    }
    if (!text || slashQuery(text) !== null) return
    if (mode === 'reply') { if (typingTimer.current) clearTimeout(typingTimer.current); sendTyping(false) }
    setContent('')
    send({ conversation_id: conversationId, content: text, sender_type: 'admin', is_internal: mode === 'note' })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutate: upload, isPending: uploading } = useMutation({
    mutationFn: uploadAttachment,
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(['messages', conversationId], (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || resolved) return
    upload({ conversation_id: conversationId, sender_type: 'admin', file, is_internal: mode === 'note' })
  }

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setHighlight((h) => (h + step + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickMacro(matches[highlight] ?? matches[0])
        return
      }
    }
    if (e.key === 'Escape' && (query !== null || macro)) {
      e.preventDefault()
      if (query !== null) setContent('')
      else setMacro(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e as unknown as FormEvent) }
  }

  const macroActions = macro ? describeActions(macro.actions) : []
  // A half-typed "/command" isn't a reply.
  const canSend = macro ? Boolean(content.trim()) || macroActions.length > 0 : Boolean(content.trim()) && query === null

  return (
    // Outer container sits on the zinc-100 canvas from AdminDashboard
    <div className="h-full flex gap-4 p-4">

      {/* ── Chat card ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 tracking-tight truncate">
              {conv ? visitorLabel(conv) : '…'}
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
              {conv && <AssignMenu conversation={conv} />}
              {conv?.visitor_email && <span className="truncate">· {conv.visitor_email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Teammates with this chat open */}
            {otherViewers.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {listNames(otherViewers)} {otherViewers.length === 1 ? 'is' : 'are'} also viewing
              </span>
            )}
            {/* Live dot */}
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-300 animate-pulse'}`} />
              {connected ? 'Live' : 'Connecting'}
            </span>
            {/* Resolve */}
            {resolved ? (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-lg">
                ✓ Resolved
              </span>
            ) : (
              <button
                onClick={() => resolve()}
                disabled={resolving}
                className="text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {resolving ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner size="xs" variant="white" />
                    Resolving…
                  </span>
                ) : 'Resolve'}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 bg-zinc-50/40">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-12">No messages yet.</p>
          )}
          {messages.map((m) => <Bubble key={m.id} message={m} />)}
          {visitorDraft && !resolved && <DraftPreview draft={visitorDraft} />}
          {resolved && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-xs text-zinc-400">Conversation resolved</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Typing indicators */}
        <div className={`px-5 bg-zinc-50/40 overflow-hidden transition-all duration-200 ${
          (visitorTyping || teammatesTyping.length > 0) && !resolved ? 'h-8 opacity-100' : 'h-0 opacity-0'
        }`}>
          <div className="flex items-center gap-4 text-xs h-8">
            {visitorTyping && (
              <span className="flex items-center gap-2 text-zinc-400">
                <TypingDots color="bg-zinc-400" />
                Visitor is typing…
              </span>
            )}
            {teammatesTyping.length > 0 && (
              <span className="flex items-center gap-2 text-amber-700 font-medium">
                <TypingDots color="bg-amber-500" />
                {listNames(teammatesTyping)} {teammatesTyping.length === 1 ? 'is' : 'are'} typing a reply…
              </span>
            )}
          </div>
        </div>

        {/* Input */}
        {!resolved ? (
          <div className={`border-t flex-shrink-0 transition-colors duration-200 ${
            mode === 'note' ? 'border-amber-200 bg-amber-50/60' : 'border-zinc-100 bg-white'
          }`}>
            {/* Mode toggle */}
            <div className="flex items-center gap-1 px-4 pt-3">
              <ModeTab label="Reply" active={mode === 'reply'} onClick={() => setMode('reply')} />
              <ModeTab label="Internal Note" active={mode === 'note'} onClick={() => setMode('note')} amber />
              {mode === 'note' && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Only visible to your team
                </span>
              )}
            </div>
            {macro && (
              <div className="mx-4 mt-2 flex items-center gap-2 text-xs bg-brand-50 text-brand-700 rounded-lg px-3 py-1.5">
                <span className="font-semibold truncate">⚡ {macro.title}</span>
                {macroActions.length > 0 && <span className="truncate text-brand-600">{macroActions.join(' · ')}</span>}
                <button
                  type="button"
                  onClick={() => { setMacro(null); resetMacroError() }}
                  aria-label="Don't use this saved reply"
                  className="ml-auto flex-shrink-0 text-brand-400 hover:text-brand-700"
                >
                  ×
                </button>
              </div>
            )}
            {macroError && (
              <p className="mx-4 mt-2 text-xs text-red-500">{apiErrorMessage(macroError, "Couldn't apply the saved reply.")}</p>
            )}
            <form onSubmit={submit} className="flex items-end gap-3 px-4 pb-4 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain"
                className="hidden"
                onChange={handleFilePicked}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || resolved}
                title="Attach a file"
                className="flex-shrink-0 w-10 h-[46px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all duration-150 disabled:opacity-40"
              >
                {uploading ? <Spinner size="xs" variant="muted" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                )}
              </button>
              <MacroPickerButton disabled={resolved} onPick={pickMacro} />
              <div className="relative flex-1 min-w-0">
                {query !== null && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm max-h-72 overflow-y-auto bg-white rounded-xl shadow-lg ring-1 ring-zinc-200 z-10">
                    <MacroList
                      macros={matches}
                      highlight={highlight}
                      onHighlight={setHighlight}
                      onPick={pickMacro}
                      empty={macros.length === 0 ? 'No saved replies yet. Add some in Settings.' : `No saved reply matches /${query}`}
                    />
                  </div>
                )}
                <textarea
                  value={content}
                  onChange={onChange}
                  onKeyDown={onComposerKeyDown}
                  aria-label={mode === 'note' ? 'Internal note' : 'Reply'}
                  placeholder={mode === 'note' ? 'Write an internal note… (never sent to visitor)' : 'Reply to visitor… (Enter to send, / for saved replies)'}
                  rows={2}
                  className={`w-full block resize-none rounded-xl px-4 py-3 text-sm placeholder:text-zinc-400 outline-none transition-all duration-200 max-h-40 ${
                    mode === 'note'
                      ? 'bg-amber-100/60 text-amber-900 ring-1 ring-amber-300 focus:ring-amber-400 placeholder:text-amber-400'
                      : 'bg-zinc-50 text-zinc-800 ring-1 ring-zinc-200 focus:ring-zinc-300 focus:bg-white'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={isPending || runningMacro || !canSend}
                className={`flex-shrink-0 disabled:opacity-40 text-white rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  mode === 'note' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-brand-500 hover:bg-brand-600'
                }`}
              >
                {runningMacro ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="xs" variant="white" />
                    <span>Applying…</span>
                  </span>
                ) : macro && macroActions.length > 0 ? (content.trim() ? 'Send & apply' : 'Apply') : isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="xs" variant="white" />
                    <span>{mode === 'note' ? 'Adding note…' : 'Sending…'}</span>
                  </span>
                ) : mode === 'note' ? 'Add note' : 'Send'}
              </button>
            </form>
          </div>
        ) : (
          <div className="border-t border-zinc-100 px-5 py-4 flex-shrink-0">
            <p className="text-xs text-center text-zinc-400">This conversation has been resolved.</p>
          </div>
        )}
      </div>

      {/* ── CRM sidebar card ──────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col gap-3">
        {/* Visitor info */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Visitor</p>
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {conv ? (visitorLabel(conv)[0] ?? '?').toUpperCase() : '?'}
              </div>
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {conv ? visitorLabel(conv) : '—'}
              </p>
            </div>

            {livePage && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-2.5 py-2">
                <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden />
                <p className="text-xs text-emerald-800 min-w-0">
                  On the site now, viewing{' '}
                  <a href={livePage.url} target="_blank" rel="noreferrer noopener" title={livePage.url} className="font-medium hover:underline break-words">
                    {pageLabel(livePage)}
                  </a>
                </p>
              </div>
            )}
            <Field label="Email" value={conv?.visitor_email ?? '—'} />
            {conv?.visitor_user_agent && (
              <Field label="Browser" value={describeBrowser(conv.visitor_user_agent) ?? 'Unknown'} />
            )}
            {conv?.visitor_referrer && (
              <Field label="Came from" value={
                <a
                  href={conv.visitor_referrer}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={conv.visitor_referrer}
                  className="text-xs text-brand-600 hover:underline break-all"
                >
                  {siteName(conv.visitor_referrer)}
                </a>
              } />
            )}
            {conv?.pre_chat_answers.map((answer) => (
              <Field key={answer.label} label={answer.label} value={answer.value} />
            ))}
            <Field label="Visitor ID" value={conv?.visitor_id ?? '—'} mono clip />
            <Field label="Started" value={conv ? fmtDate(conv.created_at) : '—'} />
            <Field label="Status" value={
              conv ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  conv.status === 'waiting' ? 'bg-amber-50 text-amber-700' :
                  conv.status === 'open'    ? 'bg-brand-50 text-brand-700' :
                                              'bg-emerald-50 text-emerald-700'
                }`}>{conv.status}</span>
              ) : '—'
            } />
            {conv?.csat_rating != null && (
              <Field label="Satisfaction" value={
                <span className="text-sm">
                  {'★'.repeat(conv.csat_rating)}{'☆'.repeat(5 - conv.csat_rating)}
                </span>
              } />
            )}
          </div>
        </div>

        {conv && <PageTrail pages={conv.visitor_pages} />}

        {/* Tags */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Tags</p>
          </div>
          <div className="p-4 flex flex-col gap-2.5">
            {conv && conv.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {conv.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium bg-zinc-100 text-zinc-600 rounded-full pl-2 pr-1 py-0.5">
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-zinc-400 hover:text-red-500 leading-none"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={addTag}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag…"
                disabled={!conv}
                className="w-full text-xs bg-zinc-50 rounded-lg px-2.5 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-200 disabled:opacity-50"
              />
            </form>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Actions</p>
          </div>
          <div className="p-2 flex flex-col gap-0.5">
            {!resolved && (
              <ActionBtn onClick={() => resolve()} disabled={resolving} icon="✓">
                Mark resolved
              </ActionBtn>
            )}
            <ActionBtn onClick={() => setMode('note')} icon="✎">
              Add internal note
            </ActionBtn>
            <ActionBtn
              onClick={() => sendTranscript()}
              disabled={!conv?.visitor_email || sendingTranscript || transcriptSent}
              icon="✉"
            >
              {sendingTranscript ? 'Sending transcript…' : transcriptSent ? 'Transcript sent' : 'Email transcript to visitor'}
            </ActionBtn>
            {!conv?.visitor_email && (
              <p className="px-3 pb-1 text-[11px] text-zinc-400">The visitor didn't leave an email.</p>
            )}
            {transcriptError && (
              <p className="px-3 pb-1 text-[11px] text-red-500">
                {apiErrorMessage(transcriptError, "Couldn't send the transcript. Please try again.")}
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function ModeTab({ label, active, onClick, amber = false }: { label: string; active: boolean; onClick: () => void; amber?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
        active
          ? amber ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-700'
          : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
      }`}
    >
      {amber && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )}
      {label}
    </button>
  )
}

function Field({ label, value, mono = false, clip = false }: { label: string; value: React.ReactNode; mono?: boolean; clip?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      {typeof value === 'string'
        ? <p className={`text-xs text-zinc-700 ${mono ? 'font-mono' : ''} ${clip ? 'truncate' : 'break-all'}`}>{value}</p>
        : value}
    </div>
  )
}

function ActionBtn({ children, onClick, disabled = false, icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 disabled:opacity-40 text-left"
    >
      <span className="text-zinc-400 w-4 text-center">{icon}</span>
      {children}
    </button>
  )
}

function AttachmentBlock({ message }: { message: Message }) {
  if (!message.attachment_url) return null
  const url = resolveAttachmentUrl(message.attachment_url)

  if (isImageAttachment(message.attachment_mime)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={url}
          alt={message.attachment_name ?? 'attachment'}
          className="rounded-lg max-h-56 max-w-full object-cover"
        />
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline underline-offset-2">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
      </svg>
      <span className="truncate text-sm">{message.attachment_name}</span>
    </a>
  )
}

function Bubble({ message: m }: { message: Message }) {
  const isAdmin = m.sender_type === 'admin'
  const isPending = m.id.startsWith('opt-')

  if (m.is_internal) {
    return (
      <div className={`px-1 transition-opacity duration-150 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        <div className="w-full bg-amber-50 border border-dashed border-amber-300 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
              Internal note{m.sender_name ? ` · ${m.sender_name}` : ''}
            </p>
            <p className="ml-auto text-[10px] text-amber-400 flex-shrink-0">
              {isPending ? '···' : fmt(m.created_at)}
            </p>
          </div>
          {m.attachment_url ? <AttachmentBlock message={m} /> : (
            <p className="text-sm text-amber-900 whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex transition-opacity duration-150 ${isAdmin ? 'justify-end' : 'justify-start'} ${isPending ? 'opacity-60' : 'opacity-100'}`}>
      <div className={`max-w-[72%] rounded-2xl px-4 py-3 ${
        isAdmin ? 'bg-brand-500 text-white' : 'bg-white ring-1 ring-zinc-200 text-zinc-800'
      }`}>
        {m.attachment_url ? <AttachmentBlock message={m} /> : (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
        )}
        <p className={`text-[11px] mt-2 text-right ${isAdmin ? 'text-brand-100' : 'text-zinc-400'}`}>
          {isPending ? '···' : fmt(m.created_at)}
        </p>
      </div>
    </div>
  )
}

// What the visitor is typing right now, before they send it. Only agents see this.
function DraftPreview({ draft }: { draft: string }) {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="max-w-[72%] rounded-2xl px-4 py-3 bg-white/60 border border-dashed border-zinc-300 text-zinc-500">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Typing preview</p>
        <p className="text-sm italic whitespace-pre-wrap break-words leading-relaxed">{draft}</p>
      </div>
    </div>
  )
}

function TypingDots({ color }: { color: string }) {
  return (
    <span className="flex gap-0.5 items-end">
      {[0, 120, 240].map((d) => (
        <span key={d} className={`w-1 h-1 ${color} rounded-full animate-bounce`} style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}
