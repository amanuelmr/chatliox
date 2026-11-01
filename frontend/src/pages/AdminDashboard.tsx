import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AdminChatWindow from '@/components/AdminChatWindow'
import ConversationList from '@/components/ConversationList'
import Spinner from '@/components/Spinner'
import { getAnalyticsSummary } from '@/api/analytics'
import { createCannedResponse, deleteCannedResponse, getCannedResponses } from '@/api/cannedResponses'
import {
  getMembers,
  removeMember,
  rotateInviteToken,
  sendInviteEmail,
  updateAutoAssign,
  updateBusinessHours,
  updateMemberRole,
  updatePreChatForm,
  updateWidgetConfig,
} from '@/api/organizations'
import { useDashboardSocket } from '@/hooks/useDashboardSocket'
import { draftProblem, parseOptions, toDraft, type DraftField } from '@/lib/preChatForm'
import { useAuthStore } from '@/store/authStore'
import type {
  BusinessHoursDay,
  FieldRequirement,
  Member,
  User,
  UserRole,
  WidgetPosition,
} from '@/types/auth'

type View = 'inbox' | 'analytics' | 'settings'

export default function AdminDashboard() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const logout = useAuthStore((s) => s.logout)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<View>('inbox')
  const isAdmin = user?.role === 'admin'

  useDashboardSocket(token)

  const embedCode = user?.organization
    ? `<script src="${window.location.origin}/widget.js" data-widget-key="${user.organization.widget_key}" async><\/script>`
    : ''

  const copyEmbed = () => {
    if (!embedCode) return
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    })
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-100">

      {/* ── Slim nav (56px) ──────────────────────────────────────────────────── */}
      <nav className="w-14 bg-white border-r border-zinc-200 flex flex-col items-center py-4 flex-shrink-0">
        <div className="flex flex-col gap-1 flex-1">
          <NavBtn title="Inbox" active={view === 'inbox'} onClick={() => { setView('inbox'); navigate('/app') }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
          </NavBtn>

          <NavBtn title={copied ? 'Copied!' : 'Install widget'} onClick={copyEmbed}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </NavBtn>

          <NavBtn title="Analytics" active={view === 'analytics'} onClick={() => setView('analytics')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </NavBtn>

          {isAdmin && (
            <NavBtn title="Settings" active={view === 'settings'} onClick={() => setView('settings')}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavBtn>
          )}
        </div>

        <UserMenu user={user} initials={initials} onSignOut={() => { logout(); navigate('/login') }} />
      </nav>

      {view === 'settings' ? (
        <SettingsView
          user={user}
          token={token}
          setAuth={setAuth}
        />
      ) : view === 'analytics' ? (
        <AnalyticsView />
      ) : (
        <>
          {/* ── Inbox column ─────────────────────────────────────────────────── */}
          <aside className="w-72 bg-white border-r border-zinc-200 flex flex-col flex-shrink-0 overflow-hidden">
            <div className="px-4 pt-5 pb-3 flex-shrink-0">
              <h1 className="text-sm font-semibold text-zinc-900 tracking-tight">Inbox</h1>
              {user?.organization && (
                <p className="text-xs text-zinc-400 mt-0.5 truncate">{user.organization.name}</p>
              )}
            </div>
            <ConversationList activeId={id} onSelect={(cid) => navigate(`/app/c/${cid}`)} />
          </aside>

          {/* ── Workspace canvas ─────────────────────────────────────────────── */}
          <main className="flex-1 bg-zinc-100 overflow-hidden min-w-0">
            {id
              ? <AdminChatWindow conversationId={id} />
              : <EmptyState onInstall={copyEmbed} copied={copied} />
            }
          </main>
        </>
      )}
    </div>
  )
}

// ─── User menu popover ───────────────────────────────────────────────────────

function UserMenu({ user, initials, onSignOut }: { user: User | null; initials: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={user?.full_name ?? 'Account'}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 text-xs font-semibold ring-2 ring-transparent ${
          open
            ? 'bg-brand-500 text-white ring-brand-400/50'
            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
        }`}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute bottom-10 left-full ml-2 w-56 bg-white rounded-2xl shadow-xl shadow-black/10 border border-zinc-100 overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{user?.full_name ?? '—'}</p>
                <p className="text-xs text-zinc-400 truncate">{user?.email ?? '—'}</p>
              </div>
            </div>
            <div className="mt-2.5">
              <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                user?.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {user?.role === 'admin' ? 'Admin' : 'Agent'}
              </span>
              {user?.organization?.name && (
                <span className="ml-1.5 text-[11px] text-zinc-400">{user.organization.name}</span>
              )}
            </div>
          </div>

          {/* Sign out */}
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings view ────────────────────────────────────────────────────────────

function AnalyticsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <main className="flex-1 bg-zinc-100 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
      </main>
    )
  }

  const maxDaily = Math.max(1, ...data.volume_by_day.map((d) => d.count))

  return (
    <main className="flex-1 bg-zinc-100 overflow-auto">
      <div className="max-w-3xl mx-auto py-10 px-6 flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Analytics</h2>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Total" value={data.total_conversations} />
          <StatTile label="Waiting" value={data.waiting_count} accent="amber" />
          <StatTile label="Open" value={data.open_count} accent="brand" />
          <StatTile label="Closed" value={data.closed_count} accent="emerald" />
          <StatTile
            label="Avg first reply"
            value={data.avg_first_response_minutes === null ? '—' : `${Math.round(data.avg_first_response_minutes)}m`}
          />
          <StatTile
            label="Avg CSAT"
            value={data.avg_csat === null ? '—' : `${data.avg_csat.toFixed(1)} / 5`}
          />
        </div>

        {/* Volume by day */}
        <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-zinc-900 mb-4">Conversations, last 7 days</p>
          {data.volume_by_day.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">No conversations in this period.</p>
          ) : (
            <div className="flex items-end gap-3 h-32">
              {data.volume_by_day.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-brand-500 rounded-t-md transition-all duration-300"
                      style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? '4px' : 0 }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-600">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per agent */}
        <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-900">Resolved by agent</p>
          </div>
          {data.per_agent.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">No resolved conversations yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.per_agent.map((a) => (
                <li key={a.agent_name} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm text-zinc-700">{a.agent_name}</span>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">{a.resolved_count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: 'amber' | 'brand' | 'emerald'
}) {
  const accentClass = accent === 'amber' ? 'text-amber-600' : accent === 'brand' ? 'text-brand-600' : accent === 'emerald' ? 'text-emerald-600' : 'text-zinc-900'
  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm px-4 py-3.5">
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold mt-1 tabular-nums ${accentClass}`}>{value}</p>
    </div>
  )
}

function SettingsView({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const [inviteToken, setInviteToken] = useState(user?.organization?.invite_token ?? '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const inviteUrl = `${window.location.origin}/join/${inviteToken}`

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2_000)
    })
  }

  const sendEmailInvite = async () => {
    if (!inviteEmail.trim()) return
    setSending(true)
    setSendStatus('idle')
    setSendError(null)
    try {
      await sendInviteEmail(inviteEmail.trim())
      setSendStatus('sent')
      setInviteEmail('')
      setTimeout(() => setSendStatus('idle'), 3_000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSendError(msg ?? 'Failed to send. Check your SMTP settings.')
      setSendStatus('error')
    } finally {
      setSending(false)
    }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const { invite_token } = await rotateInviteToken()
      setInviteToken(invite_token)
      if (token && user) {
        const updatedUser: User = {
          ...user,
          organization: { ...user.organization, invite_token },
        }
        setAuth(token, updatedUser)
      }
    } finally {
      setRotating(false)
    }
  }

  return (
    <main className="flex-1 bg-zinc-100 overflow-auto">
      <div className="max-w-lg mx-auto py-10 px-6 flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Settings</h2>

        {/* Invite teammates */}
        <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Invite teammates</p>
            <p className="text-xs text-zinc-500 mt-0.5">Enter an email address to send an invite, or copy the link to share manually.</p>
          </div>

          {/* Email invite */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendEmailInvite()}
              className="flex-1 min-w-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
            />
            <button
              onClick={sendEmailInvite}
              disabled={!inviteEmail.trim() || sending}
              className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 text-white transition-all duration-200 ${
                sendStatus === 'sent' ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
              }`}
            >
              {sending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" variant="white" />
                  Sending…
                </span>
              ) : sendStatus === 'sent' ? '✓ Sent!' : 'Send invite'}
            </button>
          </div>
          {sendStatus === 'error' && sendError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {sendError}
            </p>
          )}

          {/* Copy link */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5">Or share invite link directly</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 outline-none select-all"
              />
              <button
                onClick={copyInvite}
                className={`flex-shrink-0 text-xs font-medium px-3 py-2 rounded-lg ring-1 transition-all duration-200 ${
                  copiedInvite
                    ? 'ring-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'ring-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {copiedInvite ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={handleRotate}
            disabled={rotating}
            className="self-start text-xs font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-50 transition-colors"
          >
            {rotating ? 'Rotating…' : 'Rotate link (revokes old invites)'}
          </button>
        </div>

        {/* Widget appearance */}
        <WidgetAppearanceCard user={user} token={token} setAuth={setAuth} />

        {/* Business hours */}
        <BusinessHoursCard user={user} token={token} setAuth={setAuth} />

        {/* Pre-chat form */}
        <PreChatFormCard user={user} token={token} setAuth={setAuth} />

        {/* Chat assignment */}
        <AutoAssignCard user={user} token={token} setAuth={setAuth} />

        {/* Team members */}
        <TeamMembersCard currentUserId={user?.id ?? ''} />

        {/* Canned responses */}
        <CannedResponsesCard />
      </div>
    </main>
  )
}

function WidgetAppearanceCard({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const org = user?.organization
  const [color, setColor] = useState(org?.widget_color ?? '#4f6ef7')
  const [greeting, setGreeting] = useState(org?.widget_greeting ?? '')
  const [position, setPosition] = useState<WidgetPosition>(org?.widget_position ?? 'right')
  const [iconUrl, setIconUrl] = useState(org?.widget_icon_url ?? '')
  const [width, setWidth] = useState(org?.widget_width ?? 376)
  const [height, setHeight] = useState(org?.widget_height ?? 600)
  const [offsetX, setOffsetX] = useState(org?.widget_offset_x ?? 20)
  const [offsetY, setOffsetY] = useState(org?.widget_offset_y ?? 20)
  const [saved, setSaved] = useState(false)

  const iconUrlValid = iconUrl.trim() === '' || /^https?:\/\/.+/.test(iconUrl.trim())

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      updateWidgetConfig({
        widget_color: color,
        widget_greeting: greeting.trim(),
        widget_position: position,
        widget_icon_url: iconUrl.trim(),
        widget_width: width,
        widget_height: height,
        widget_offset_x: offsetX,
        widget_offset_y: offsetY,
      }),
    onSuccess: (updatedOrg) => {
      if (token && user) setAuth(token, { ...user, organization: updatedOrg })
      setSaved(true)
      setTimeout(() => setSaved(false), 2_000)
    },
  })

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Widget appearance</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Customize color, launcher icon, position and size — visitors see this without any changes to the install snippet.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
        />
      </div>

      <textarea
        value={greeting}
        onChange={(e) => setGreeting(e.target.value)}
        rows={2}
        maxLength={280}
        placeholder="Send us a message and we'll get back to you shortly."
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
      />

      <div>
        <p className="text-xs font-medium text-zinc-700 mb-1.5">Launcher position</p>
        <div className="flex gap-2">
          {(['right', 'left'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`flex-1 text-sm rounded-lg px-3 py-2 ring-1 transition-all duration-150 ${
                position === p
                  ? 'bg-brand-50 ring-brand-300 text-brand-700 font-medium'
                  : 'ring-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              Bottom {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-700 mb-1.5">Launcher icon</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-zinc-200">
            {iconUrl.trim() && iconUrlValid ? (
              <img src={iconUrl.trim()} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-zinc-400 text-xs">💬</span>
            )}
          </div>
          <input
            type="text"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://example.com/icon.png (optional)"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-100 transition ${
              iconUrlValid ? 'border-zinc-200 focus:border-brand-500' : 'border-red-300 focus:border-red-400'
            }`}
          />
          {iconUrl && (
            <button
              type="button"
              onClick={() => setIconUrl('')}
              className="text-xs text-zinc-500 hover:text-zinc-700 flex-shrink-0"
            >
              Reset
            </button>
          )}
        </div>
        {!iconUrlValid && <p className="text-xs text-red-500 mt-1">Must be a full http(s) image URL.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Panel width" value={width} onChange={setWidth} min={320} max={520} />
        <NumberField label="Panel height" value={height} onChange={setHeight} min={400} max={800} />
        <NumberField label="Side offset" value={offsetX} onChange={setOffsetX} min={0} max={200} />
        <NumberField label="Bottom offset" value={offsetY} onChange={setOffsetY} min={0} max={200} />
      </div>

      <button
        onClick={() => save()}
        disabled={saving || !greeting.trim() || !/^#[0-9a-fA-F]{6}$/.test(color) || !iconUrlValid}
        className={`self-start text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 text-white transition-all duration-200 ${
          saved ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
        }`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DEFAULT_SCHEDULE: BusinessHoursDay[] = WEEKDAYS.map((_, i) => ({
  enabled: i < 5,
  start: '09:00',
  end: '17:00',
}))

function timezoneOptions(current: string): string[] {
  // Intl.supportedValuesOf isn't in the ES2020 lib typings but ships in every evergreen browser.
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  const zones = supported ? supported('timeZone') : []
  return Array.from(new Set(['UTC', current, ...zones]))
}

function BusinessHoursCard({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const org = user?.organization
  const [enabled, setEnabled] = useState(org?.business_hours_enabled ?? false)
  const [timezone, setTimezone] = useState(
    // Pre-fill the admin's own timezone the first time they turn this on.
    org?.business_hours_enabled ? org.business_hours_timezone : Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [schedule, setSchedule] = useState<BusinessHoursDay[]>(org?.business_hours ?? DEFAULT_SCHEDULE)
  const [awayMessage, setAwayMessage] = useState(org?.away_message ?? '')
  const [saved, setSaved] = useState(false)

  const updateDay = (index: number, patch: Partial<BusinessHoursDay>) =>
    setSchedule((days) => days.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  const invalidDay = schedule.some((d) => d.enabled && d.end <= d.start)

  const { mutate: save, isPending: saving, error } = useMutation({
    mutationFn: () =>
      updateBusinessHours({
        business_hours_enabled: enabled,
        business_hours_timezone: timezone,
        business_hours: schedule,
        away_message: awayMessage.trim(),
      }),
    onSuccess: (updatedOrg) => {
      if (token && user) setAuth(token, { ...user, organization: updatedOrg })
      setSaved(true)
      setTimeout(() => setSaved(false), 2_000)
    },
  })

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Business hours</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Outside these hours the widget shows your away message and asks visitors for an email so you can reply later.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable business hours"
          onClick={() => setEnabled((v) => !v)}
          className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-brand-500' : 'bg-zinc-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <fieldset disabled={!enabled} className={`flex flex-col gap-4 transition-opacity ${enabled ? '' : 'opacity-50'}`}>
        <label className="text-xs font-medium text-zinc-700 flex flex-col gap-1.5">
          Timezone
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition bg-white"
          >
            {timezoneOptions(timezone).map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          {schedule.map((day, i) => (
            <div key={WEEKDAYS[i]} className="flex items-center gap-3">
              <label className="w-28 flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(i, { enabled: e.target.checked })}
                  className="rounded border-zinc-300 text-brand-500 focus:ring-brand-100"
                />
                {WEEKDAYS[i].slice(0, 3)}
              </label>
              {day.enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => updateDay(i, { start: e.target.value })}
                    className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                  />
                  <span className="text-zinc-400">–</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => updateDay(i, { end: e.target.value })}
                    className={`rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-100 transition ${
                      day.end <= day.start ? 'border-red-300' : 'border-zinc-200 focus:border-brand-500'
                    }`}
                  />
                </div>
              ) : (
                <span className="text-sm text-zinc-400">Closed</span>
              )}
            </div>
          ))}
          {invalidDay && <p className="text-xs text-red-500">Closing time must be after opening time.</p>}
        </div>

        <label className="text-xs font-medium text-zinc-700 flex flex-col gap-1.5">
          Away message
          <textarea
            value={awayMessage}
            onChange={(e) => setAwayMessage(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="We're away right now. Leave a message and we'll get back to you by email."
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
          />
        </label>
      </fieldset>

      {error && <p className="text-xs text-red-500">Couldn't save business hours. Please try again.</p>}

      <button
        onClick={() => save()}
        disabled={saving || !awayMessage.trim() || invalidDay}
        className={`self-start text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 text-white transition-all duration-200 ${
          saved ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
        }`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

const MAX_PRE_CHAT_FIELDS = 5

const REQUIREMENT_LABELS: Record<FieldRequirement, string> = {
  hidden: "Don't ask",
  optional: 'Optional',
  required: 'Required',
}

function PreChatFormCard({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const org = user?.organization
  const [nameRequirement, setNameRequirement] = useState<FieldRequirement>(org?.pre_chat_name ?? 'optional')
  const [emailRequirement, setEmailRequirement] = useState<FieldRequirement>(org?.pre_chat_email ?? 'optional')
  const [fields, setFields] = useState<DraftField[]>(() => (org?.pre_chat_fields ?? []).map(toDraft))
  const [saved, setSaved] = useState(false)

  const updateField = (key: string, patch: Partial<DraftField>) =>
    setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)))

  const addField = () =>
    setFields((list) => [
      ...list,
      { key: crypto.randomUUID(), label: '', type: 'text', optionsText: '', required: false },
    ])

  const problem = draftProblem(fields)

  const { mutate: save, isPending: saving, error } = useMutation({
    mutationFn: () =>
      updatePreChatForm({
        pre_chat_name: nameRequirement,
        pre_chat_email: emailRequirement,
        pre_chat_fields: fields.map((f) => ({
          id: f.id,
          label: f.label.trim(),
          type: f.type,
          options: f.type === 'select' ? parseOptions(f.optionsText) : [],
          required: f.required,
        })),
      }),
    onSuccess: (updatedOrg) => {
      if (token && user) setAuth(token, { ...user, organization: updatedOrg })
      setFields(updatedOrg.pre_chat_fields.map(toDraft))
      setSaved(true)
      setTimeout(() => setSaved(false), 2_000)
    },
  })

  const inputClass =
    'rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition bg-white'

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Pre-chat form</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          What visitors fill in before their first message. Answers show next to the conversation in the inbox.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          ['Name', nameRequirement, setNameRequirement],
          ['Email', emailRequirement, setEmailRequirement],
        ] as const).map(([label, value, setValue]) => (
          <label key={label} className="text-xs font-medium text-zinc-700 flex flex-col gap-1.5">
            {label}
            <select value={value} onChange={(e) => setValue(e.target.value as FieldRequirement)} className={inputClass}>
              {(Object.keys(REQUIREMENT_LABELS) as FieldRequirement[]).map((r) => (
                <option key={r} value={r}>{REQUIREMENT_LABELS[r]}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {emailRequirement !== 'required' && (
        <p className="text-xs text-zinc-400 -mt-2">Email is always required outside business hours.</p>
      )}

      {fields.length > 0 && (
        <div className="flex flex-col gap-3">
          {fields.map((f) => (
            <div key={f.key} className="rounded-lg ring-1 ring-zinc-200 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) => updateField(f.key, { label: e.target.value })}
                  maxLength={60}
                  placeholder="Question, e.g. Order number"
                  aria-label="Question label"
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(f.key, { type: e.target.value as DraftField['type'] })}
                  aria-label="Answer type"
                  className={inputClass}
                >
                  <option value="text">Short answer</option>
                  <option value="select">Dropdown</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFields((list) => list.filter((x) => x.key !== f.key))}
                  aria-label={`Remove ${f.label || 'question'}`}
                  className="text-zinc-400 hover:text-red-500 px-1.5 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              {f.type === 'select' && (
                <input
                  value={f.optionsText}
                  onChange={(e) => updateField(f.key, { optionsText: e.target.value })}
                  placeholder="Options, separated by commas"
                  aria-label="Dropdown options"
                  className={inputClass}
                />
              )}
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => updateField(f.key, { required: e.target.checked })}
                  className="rounded border-zinc-300 text-brand-500 focus:ring-brand-100"
                />
                Required
              </label>
            </div>
          ))}
        </div>
      )}

      {fields.length < MAX_PRE_CHAT_FIELDS && (
        <button
          type="button"
          onClick={addField}
          className="self-start text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          + Add question
        </button>
      )}

      {problem && <p className="text-xs text-red-500">{problem}</p>}
      {error && <p className="text-xs text-red-500">Couldn't save the pre-chat form. Please try again.</p>}

      <button
        onClick={() => save()}
        disabled={saving || problem !== null}
        className={`self-start text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 text-white transition-all duration-200 ${
          saved ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
        }`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
}) {
  return (
    <label className="text-xs font-medium text-zinc-700 flex flex-col gap-1.5">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
      />
    </label>
  )
}

function AutoAssignCard({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const enabled = user?.organization.auto_assign ?? false

  const { mutate: toggle, isPending, error } = useMutation({
    mutationFn: () => updateAutoAssign(!enabled),
    onSuccess: (updatedOrg) => {
      if (token && user) setAuth(token, { ...user, organization: updatedOrg })
    },
  })

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Auto-assign new chats</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Each new chat goes to the next teammate in turn, among those with the dashboard open. If nobody is online,
            it stays unassigned until someone replies.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Auto-assign new chats"
          disabled={isPending}
          onClick={() => toggle()}
          className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${
            enabled ? 'bg-brand-500' : 'bg-zinc-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-500">Couldn't update auto-assignment. Please try again.</p>}
    </div>
  )
}

function CannedResponsesCard() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: getCannedResponses,
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => createCannedResponse({ title: title.trim(), content: content.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      setTitle('')
      setContent('')
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => deleteCannedResponse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canned-responses'] }),
  })

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <p className="text-sm font-semibold text-zinc-900">Saved replies</p>
        <p className="text-xs text-zinc-500 mt-0.5">Insert these into the reply box from any conversation.</p>
      </div>

      <div className="px-6 py-4 flex flex-col gap-2 border-b border-zinc-100">
        <input
          type="text"
          placeholder="Shortcut title (e.g. Refund policy)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
        />
        <textarea
          placeholder="Reply text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
        />
        <button
          onClick={() => create()}
          disabled={!title.trim() || !content.trim() || creating}
          className="self-start text-sm font-medium bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-all duration-200"
        >
          {creating ? 'Adding…' : 'Add saved reply'}
        </button>
      </div>

      {isLoading ? (
        <div className="px-6 py-6 flex justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
        </div>
      ) : responses.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-6">No saved replies yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {responses.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-6 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{r.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap break-words">{r.content}</p>
              </div>
              <button
                onClick={() => remove(r.id)}
                title="Delete"
                className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamMembersCard({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
  })

  const { mutate: changeRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateMemberRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  const adminCount = members.filter((m) => m.role === 'admin').length

  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Team members</p>
          <p className="text-xs text-zinc-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {isLoading ? (
        <div className="px-6 py-6 flex justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {members.map((m: Member) => {
            const isSelf = m.id === currentUserId
            const canDemote = !(m.role === 'admin' && adminCount <= 1)
            return (
              <li key={m.id} className="flex items-center gap-3 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {m.full_name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {m.full_name}{isSelf && <span className="ml-1.5 text-xs text-zinc-400">(you)</span>}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                </div>
                <select
                  value={m.role}
                  disabled={isSelf && !canDemote}
                  onChange={(e) => changeRole({ id: m.id, role: e.target.value as UserRole })}
                  className="text-xs font-medium rounded-md px-2 py-1 border border-zinc-200 bg-zinc-50 text-zinc-700 outline-none focus:border-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
                {!isSelf && (
                  <button
                    onClick={() => remove(m.id)}
                    title="Remove member"
                    className="ml-1 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function NavBtn({
  children, title, onClick, active = false,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
        active ? 'bg-brand-50 text-brand-600' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ onInstall, copied }: { onInstall: () => void; copied: boolean }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-zinc-200 p-10 flex flex-col items-center gap-5 text-center max-w-sm w-full">
        <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-zinc-900 tracking-tight">No conversation selected</p>
          <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
            Select a thread from the inbox to start replying, or install your chat widget to begin receiving messages.
          </p>
        </div>
        <button
          onClick={onInstall}
          className={`w-full text-sm font-medium py-2.5 rounded-xl ring-1 transition-all duration-200 ${
            copied
              ? 'ring-emerald-300 bg-emerald-50 text-emerald-700'
              : 'ring-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          {copied ? '✓ Embed code copied!' : 'Copy widget install snippet'}
        </button>
      </div>
    </div>
  )
}
