import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { createConversation, getVisitorConversationStatus } from '@/api/conversations'
import { getVisitorMessages, sendMessage, uploadAttachment } from '@/api/messages'
import { getWidgetConfig } from '@/api/organizations'
import { isImageAttachment, resolveAttachmentUrl } from '@/lib/attachments'
import Spinner from '@/components/Spinner'
import type { ConversationStatus, Message, WsEvent } from '@/types/chat'

const DEFAULT_BRAND_COLOR = '#4f6ef7'
const DEFAULT_GREETING = "Send us a message and we'll get back to you shortly."

function widgetErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) return 'Too many requests. Please wait a moment.'
    if (!error.response || error.response.status >= 500) return 'Chat is temporarily unavailable.'
  }
  return 'Something went wrong. Please try again.'
}

function getOrCreateVisitorId(widgetKey: string): string {
  const storageKey = `chatliox_visitor_id_${widgetKey}`
  const stored = localStorage.getItem(storageKey)
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem(storageKey, id)
  return id
}

function getStoredConversationId(widgetKey: string): string | null {
  return localStorage.getItem(`chatliox_conversation_id_${widgetKey}`)
}

function storeConversationId(widgetKey: string, id: string): void {
  localStorage.setItem(`chatliox_conversation_id_${widgetKey}`, id)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WidgetPage() {
  const [searchParams] = useSearchParams()
  const widgetKey = searchParams.get('key') ?? ''

  const [isOpen, setIsOpen] = useState(false)
  const [visitorId] = useState(() => getOrCreateVisitorId(widgetKey))
  const [conversationId, setConversationId] = useState<string | null>(
    () => getStoredConversationId(widgetKey)
  )
  const [adminName, setAdminName] = useState<string | null>(null)
  const [convStatus, setConvStatus] = useState<ConversationStatus | null>(null)

  const { data: widgetConfig } = useQuery({
    queryKey: ['widget-config', widgetKey],
    queryFn: () => getWidgetConfig(widgetKey),
    staleTime: Infinity,
  })
  const brandColor = widgetConfig?.widget_color ?? DEFAULT_BRAND_COLOR
  const greeting = widgetConfig?.widget_greeting ?? DEFAULT_GREETING

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  if (!widgetKey) {
    return (
      <div className="fixed bottom-5 right-5">
        <div className="w-14 h-14 bg-zinc-300 rounded-full" title="Widget key missing" />
      </div>
    )
  }

  const handleConversationCreated = (id: string) => {
    storeConversationId(widgetKey, id)
    setConversationId(id)
  }

  return (
    <div className="fixed inset-0 flex items-end justify-end p-5 pointer-events-none">

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div
        className={`pointer-events-auto mb-16 w-[360px] h-[540px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden origin-bottom-right transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <PanelHeader onClose={() => setIsOpen(false)} adminName={adminName} brandColor={brandColor} />
        {conversationId ? (
          <ChatView conversationId={conversationId} visitorId={visitorId} onAdminName={setAdminName} convStatus={convStatus} onStatusChange={setConvStatus} brandColor={brandColor} />
        ) : (
          <WelcomeView
            visitorId={visitorId}
            widgetKey={widgetKey}
            onConversationCreated={handleConversationCreated}
            brandColor={brandColor}
            greeting={greeting}
          />
        )}
      </div>

      {/* ── Launcher button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{ backgroundColor: brandColor }}
        className="pointer-events-auto w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ease-out hover:scale-105 active:scale-95 flex-shrink-0"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <span className={`absolute transition-all duration-200 ${isOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <span className={`absolute transition-all duration-200 ${isOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </span>
      </button>
    </div>
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({
  onClose,
  adminName,
  brandColor,
}: {
  onClose: () => void
  adminName: string | null
  brandColor: string
}) {
  return (
    <div style={{ backgroundColor: brandColor }} className="px-5 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight tracking-tight">{adminName ?? 'Support'}</p>
          <p className="text-white/50 text-xs mt-0.5">
            {adminName ? 'Here to help you' : 'We typically reply in a few minutes'}
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-white/60 hover:text-white transition-all duration-200 p-1.5 rounded-lg hover:bg-white/20"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

interface WelcomeViewProps {
  visitorId: string
  widgetKey: string
  onConversationCreated: (id: string) => void
  brandColor: string
  greeting: string
}

function WelcomeView({ visitorId, widgetKey, onConversationCreated, brandColor, greeting }: WelcomeViewProps) {
  const [name, setName] = useState('')
  const [firstMessage, setFirstMessage] = useState('')

  const { mutate: startChat, isPending, error: startError } = useMutation({
    mutationFn: async () => {
      const conv = await createConversation({
        visitor_id: visitorId,
        visitor_name: name.trim() || undefined,
        widget_key: widgetKey,
      })
      if (firstMessage.trim()) {
        await sendMessage({
          conversation_id: conv.id,
          content: firstMessage.trim(),
          sender_type: 'visitor',
        })
      }
      return conv
    },
    onSuccess: (conv) => onConversationCreated(conv.id),
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div style={{ backgroundColor: brandColor }} className="px-5 pb-5">
        <p className="text-white/60 text-xs leading-relaxed">{greeting}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-50 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-200"
        />
        <textarea
          placeholder="How can we help you?"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={4}
          className="w-full bg-zinc-50 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-200 resize-none"
        />

        {startError && (
          <p className="text-xs text-red-500 px-1">{widgetErrorMessage(startError)}</p>
        )}

        <button
          onClick={() => startChat()}
          disabled={!firstMessage.trim() || isPending}
          style={{ backgroundColor: brandColor }}
          className="w-full disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-all duration-200"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" variant="white" />
              Starting…
            </span>
          ) : 'Send message →'}
        </button>
      </div>
    </div>
  )
}

// ─── Chat view ────────────────────────────────────────────────────────────────

interface ChatViewProps {
  conversationId: string
  visitorId: string
  onAdminName: (name: string | null) => void
  convStatus: ConversationStatus | null
  onStatusChange: (s: ConversationStatus) => void
  brandColor: string
}

function ChatView({ conversationId, visitorId, onAdminName, convStatus, onStatusChange, brandColor }: ChatViewProps) {
  const queryClient = useQueryClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState('')
  const [adminTyping, setAdminTyping] = useState(false)

  const { data: messages = [], isLoading, isError: messagesUnavailable } = useQuery({
    queryKey: ['widget-messages', conversationId],
    queryFn: () => getVisitorMessages(conversationId, visitorId),
    retry: 2,
  })

  const { data: statusData } = useQuery({
    queryKey: ['widget-conv-status', conversationId],
    queryFn: () => getVisitorConversationStatus(conversationId, visitorId),
  })

  useEffect(() => {
    if (statusData) onStatusChange(statusData.status)
  }, [statusData, onStatusChange])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const adminDisplayName = [...messages].reverse().find((m) => m.sender_type === 'admin' && m.sender_name)?.sender_name ?? null

  useEffect(() => {
    onAdminName(adminDisplayName)
  }, [adminDisplayName, onAdminName])

  const appendMessage = useCallback(
    (msg: Message) => {
      queryClient.setQueryData<Message[]>(['widget-messages', conversationId], (prev = []) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
    },
    [queryClient, conversationId]
  )

  useEffect(() => {
    let active = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      wsRef.current?.close()
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.DEV
        ? window.location.host
        : (import.meta.env.VITE_API_URL as string).replace(/^https?:\/\//, '')
      const ws = new WebSocket(
        `${proto}//${host}/ws/conversations/${conversationId}?visitor_id=${visitorId}`
      )
      wsRef.current = ws

      ws.onmessage = (event: MessageEvent) => {
        try {
          const evt = JSON.parse(event.data as string) as WsEvent
          if (evt.type === 'message' && !evt.is_internal) appendMessage(evt)
          else if (evt.type === 'typing') setAdminTyping(evt.is_typing)
          else if (evt.type === 'status') onStatusChange(evt.status)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (!active) return
        reconnectTimer = setTimeout(connect, 2_000)
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [conversationId, visitorId, appendMessage])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
    }
  }, [])

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    sendTyping(true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => sendTyping(false), 2_000)
  }

  const { mutate: send, isPending, error: sendError } = useMutation({
    mutationFn: sendMessage,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['widget-messages', conversationId] })
      const prev = queryClient.getQueryData<Message[]>(['widget-messages', conversationId]) ?? []
      const tempId = `opt-${Date.now()}`
      queryClient.setQueryData<Message[]>(['widget-messages', conversationId], [
        ...prev,
        {
          id: tempId,
          conversation_id: conversationId,
          content: vars.content,
          sender_type: 'visitor',
          sender_id: null,
          sender_name: null,
          is_read: false,
          is_internal: false,
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
        ['widget-messages', conversationId],
        (msgs = []) => msgs.map((m) => (m.id === ctx?.tempId ? real : m)),
      )
    },
    onError: (_, vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['widget-messages', conversationId], ctx.prev)
      setContent(vars.content)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping(false)
    setContent('')
    if (convStatus === 'closed') onStatusChange('waiting')
    send({ conversation_id: conversationId, content: text, sender_type: 'visitor' })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutate: upload, isPending: uploading } = useMutation({
    mutationFn: uploadAttachment,
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(['widget-messages', conversationId], (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      )
    },
  })

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (convStatus === 'closed') onStatusChange('waiting')
    upload({ conversation_id: conversationId, sender_type: 'visitor', file })
  }

  if (messagesUnavailable) return <UnavailableState />

  return (
    <>
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 bg-zinc-50/50"
      >
        {isLoading && (
          <p className="text-center text-xs text-zinc-400 py-6">Loading…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-xs text-zinc-400 py-6">No messages yet.</p>
        )}
        {messages.filter((msg) => !msg.is_internal).map((msg) => (
          <WidgetBubble key={msg.id} message={msg} brandColor={brandColor} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Admin typing indicator */}
      <div className={`px-4 bg-zinc-50/50 transition-all duration-200 overflow-hidden ${
        adminTyping ? 'h-7 opacity-100' : 'h-0 opacity-0'
      }`}>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex items-end gap-0.5 h-3">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          {adminDisplayName ?? 'Support'} is typing…
        </div>
      </div>

      {/* Resolved banner — slides in from top when status changes to closed */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${
        convStatus === 'closed' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="mx-3 mb-2 mt-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <p className="text-xs text-emerald-700 font-medium leading-snug">
            This conversation was resolved. Reply below to reopen it.
          </p>
        </div>
      </div>

      {sendError && (
        <div className="px-4 pb-1 bg-white">
          <p className="text-xs text-red-500">{widgetErrorMessage(sendError)}</p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-t border-zinc-200 px-3 py-2.5 flex items-end gap-2 flex-shrink-0"
      >
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
          disabled={uploading}
          aria-label="Attach a file"
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all duration-150 disabled:opacity-40"
        >
          {uploading ? <Spinner size="xs" variant="muted" /> : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
            </svg>
          )}
        </button>
        <textarea
          value={content}
          onChange={handleContentChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e as unknown as FormEvent)
            }
          }}
          placeholder={convStatus === 'closed' ? 'Reply to reopen…' : 'Type a message…'}
          rows={1}
          className="flex-1 resize-none bg-zinc-50 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all duration-200 max-h-28"
        />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          aria-label={isPending ? 'Sending' : 'Send message'}
          style={{ backgroundColor: brandColor }}
          className="disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-all duration-200 flex-shrink-0 flex items-center justify-center w-10"
        >
          {isPending ? (
            <Spinner size="xs" variant="white" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </form>
    </>
  )
}

// ─── Unavailable state ────────────────────────────────────────────────────────

function UnavailableState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50">
      <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-700 tracking-tight">Chat temporarily unavailable</p>
      <p className="text-xs text-zinc-400 leading-relaxed">Having trouble connecting. Please try again in a few minutes.</p>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function WidgetAttachment({ message }: { message: Message }) {
  if (!message.attachment_url) return null
  const url = resolveAttachmentUrl(message.attachment_url)

  if (isImageAttachment(message.attachment_mime)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={url}
          alt={message.attachment_name ?? 'attachment'}
          className="rounded-lg max-h-48 max-w-full object-cover"
        />
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline underline-offset-2">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
      </svg>
      <span className="truncate">{message.attachment_name}</span>
    </a>
  )
}

function WidgetBubble({ message, brandColor }: { message: Message; brandColor: string }) {
  const isVisitor = message.sender_type === 'visitor'
  const isPending = message.id.startsWith('opt-')

  return (
    <div className={`flex transition-opacity duration-150 ${isVisitor ? 'justify-end' : 'justify-start'} ${isPending ? 'opacity-60' : 'opacity-100'}`}>
      <div
        style={isVisitor ? { backgroundColor: brandColor } : undefined}
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isVisitor ? 'text-white' : 'bg-white ring-1 ring-zinc-200 text-zinc-800'
        }`}
      >
        {message.attachment_url ? <WidgetAttachment message={message} /> : (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}
        <p className={`text-xs mt-1 text-right ${isVisitor ? 'text-brand-100' : 'text-zinc-400'}`}>
          {isPending ? '···' : formatTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}
