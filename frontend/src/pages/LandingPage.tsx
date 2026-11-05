import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '@/components/Logo'
import StarField from '@/components/landing/StarField'

// ─── Small pieces ────────────────────────────────────────────────────────────

function ArrowUpRight({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H8M17 7v9" />
    </svg>
  )
}

function Plus({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-[11px] h-[11px] text-zinc-400 ${className}`} viewBox="0 0 11 11" fill="none" aria-hidden>
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** Full-width hairline between sections, with a cross where it meets each rail. */
function Divider() {
  return (
    <div className="relative h-px bg-rail" aria-hidden>
      <Plus className="absolute -left-[6px] -top-[5px]" />
      <Plus className="absolute -right-[6px] -top-[5px]" />
    </div>
  )
}

function Dot({ className = 'bg-emerald-500' }: { className?: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${className}`} aria-hidden />
}

/** Headline in two tones: the claim in white, the follow-through in grey. */
function TwoTone({ lead, rest, className = '' }: { lead: ReactNode; rest: ReactNode; className?: string }) {
  return (
    <h2 className={`font-medium tracking-[-0.035em] text-zinc-900 ${className}`}>
      {lead} <span className="text-zinc-400">{rest}</span>
    </h2>
  )
}

/** Bordered figure with mono captions in its corners. */
function Figure({
  tl, tr, bl, br, children, className = '',
}: { tl: string; tr: string; bl?: string; br?: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`relative rounded-2xl border border-zinc-200 bg-[#0b0b0b] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 pt-3.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-zinc-400">
        <span className="normal-case tracking-normal">{tl}</span>
        <span>{tr}</span>
      </div>
      {children}
      {(bl || br) && (
        <div className="flex items-center justify-between px-4 pb-3.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-zinc-400">
          <span>{bl}</span>
          <span className="normal-case tracking-normal">{br}</span>
        </div>
      )}
    </figure>
  )
}

// ─── Announcement ticker ─────────────────────────────────────────────────────

const NEWS = [
  { tag: 'New', text: 'Welcome messages and quick replies now open every chat.', link: 'See Engage', to: '/register' },
  { tag: 'Update', text: 'Put the launcher in any corner and restyle it with your own CSS.', link: 'Read the guide', to: '/guide' },
  { tag: 'Guide', text: 'Install the widget with one script tag in about five minutes.', link: 'Start', to: '/guide' },
]

function Ticker({ onClose }: { onClose: () => void }) {
  const items = [...NEWS, ...NEWS]
  return (
    <div className="relative h-[34px] border-b border-rail bg-black text-[12.5px] overflow-hidden">
      <div className="ticker-track flex h-full w-max items-center">
        {items.map((n, i) => (
          <span key={i} className="flex items-center gap-2 px-10 whitespace-nowrap text-zinc-700" aria-hidden={i >= NEWS.length}>
            <span className="text-[11px] text-emerald-500/80">{n.tag}</span>
            {n.text}
            <Link to={n.to} className="text-zinc-900 underline underline-offset-[3px] decoration-zinc-400 hover:decoration-zinc-900" tabIndex={i >= NEWS.length ? -1 : 0}>
              {n.link}
            </Link>
            <span className="ml-10 text-zinc-300">•</span>
          </span>
        ))}
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss announcements"
        className="absolute right-0 top-0 h-full px-4 bg-gradient-to-l from-black via-black to-transparent pl-10 text-zinc-500 hover:text-zinc-900"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 h-[60px] border-b border-rail bg-black/80 backdrop-blur-md">
      <div className="h-full px-5 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Chatliox home">
            <Logo className="h-[22px] w-auto" variant="dark" alt="" markOnly />
            <span className="text-[19px] font-medium tracking-[-0.03em] text-zinc-900">Chatliox</span>
          </Link>
          <span className="hidden md:block h-5 w-px bg-zinc-200" />
          <nav className="hidden md:flex items-center gap-1 text-[13.5px] font-medium text-zinc-600">
            {[
              { label: 'Product', href: '#product' },
              { label: 'Features', href: '#features' },
              { label: 'Install', href: '#install' },
            ].map((l) => (
              <a key={l.label} href={l.href} className="px-3 py-1.5 rounded-lg hover:text-zinc-900 hover:bg-zinc-100 transition">
                {l.label}
              </a>
            ))}
            <Link to="/guide" className="px-3 py-1.5 rounded-lg hover:text-zinc-900 hover:bg-zinc-100 transition inline-flex items-center gap-1">
              Guide <ArrowUpRight className="w-3 h-3 text-zinc-400" />
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-flex px-3 py-1.5 text-[13.5px] font-medium text-zinc-700 hover:text-zinc-900 transition">
            Sign in
          </Link>
          <Link to="/register" className="btn-pill">
            Get started
            <span className="btn-pill-chip"><ArrowUpRight /></span>
          </Link>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

/** Faint star-chart drawing of a speech bubble, one on each side of the hero. */
function BubbleConstellation({ flip = false }: { flip?: boolean }) {
  const pts: [number, number][] = [
    [40, 60], [150, 22], [270, 40], [318, 120], [292, 210], [190, 250], [120, 246], [70, 312], [86, 240], [28, 190], [16, 120],
  ]
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z'
  const inner: [number, number][] = [[110, 120], [170, 132], [230, 120]]
  return (
    <svg
      viewBox="0 0 340 330"
      className={`float-slow hidden lg:block absolute top-32 w-[300px] xl:w-[340px] opacity-60 pointer-events-none ${flip ? 'right-[4%] -scale-x-100 [animation-delay:-4.5s]' : 'left-[4%]'}`}
      aria-hidden
    >
      <path d={d} fill="none" stroke="rgb(var(--zinc-400))" strokeOpacity="0.45" strokeWidth="0.75" />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 2.4 : 1.6}
          fill="rgb(var(--zinc-800))"
          className="constellation-glow"
          style={{ animationDelay: `${-i * 370}ms` }}
        />
      ))}
      <path d="M110 120 L170 132 L230 120" fill="none" stroke="rgb(var(--zinc-400))" strokeOpacity="0.35" strokeWidth="0.75" strokeDasharray="2 4" />
      {inner.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="rgb(var(--zinc-900))" className="constellation-glow" style={{ animationDelay: `${-(i + 4) * 370}ms` }} />
      ))}
    </svg>
  )
}

function Hero() {
  return (
    <section id="product" className="starfield relative bg-black pt-24 md:pt-28 pb-16 px-5 overflow-hidden">
      <StarField className="[mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />
      <BubbleConstellation />
      <BubbleConstellation flip />
      <div className="relative flex flex-col items-center text-center">
        <Logo className="h-9 w-auto mb-8" variant="dark" alt="" markOnly />
        <h1 className="text-[3.1rem] leading-[1.02] sm:text-7xl lg:text-[7rem] font-[450] tracking-[-0.055em] text-[#f2f2f2] max-w-[15ch]">
          The live chat your customers will love
        </h1>
        <p className="mt-8 max-w-[30rem] text-[15.5px] leading-relaxed text-zinc-600">
          One script tag puts a chat on every page. Your team answers from a shared inbox,
          with notes, saved replies and routing built in.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/register" className="btn-pill btn-pill-lg">
            Get started
            <span className="btn-pill-chip"><ArrowUpRight /></span>
          </Link>
          <Link to="/guide" className="btn-ghost btn-pill-lg">
            Read the guide
            <span className="btn-pill-chip"><ArrowUpRight /></span>
          </Link>
        </div>
        <p className="mt-8 flex items-center gap-2 text-[13px] text-zinc-500">
          <Dot /> Live in five minutes <span className="text-zinc-300">·</span> Hosted or self-hosted
        </p>
      </div>

      <div className="relative mt-16 md:mt-20 mx-auto max-w-[1240px]">
        <div className="rounded-[22px] border border-[#2a2a2a] bg-[#0d0d0d] p-2 shadow-[0_50px_140px_-40px_rgba(0,0,0,1)]">
          <AppMockup />
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5"><Dot /> Product preview · sample data</span>
            <span className="hidden sm:inline">Messages arrive over WebSocket in under 100 ms</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Product mockup ──────────────────────────────────────────────────────────
// A static copy of the real inbox (AdminDashboard + ConversationList +
// AdminChatWindow), built from the same classes so it reads as the product.

const RAIL_ICONS = [
  'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z',
  'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
  'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
  'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
  'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
]

const MOCK_CHATS = [
  { name: 'Maya Chen', msg: 'Sorry about that, Maya. The second…', time: 'now', tone: 'bg-sky-100 text-sky-700', unread: false },
  { name: 'Leo Park', msg: 'Is there a way to change the widget…', time: '2m', tone: 'bg-teal-100 text-teal-700', unread: true },
  { name: 'Sam Ortiz', msg: 'Thanks for the quick fix yesterday…', time: '5m', tone: 'bg-violet-100 text-violet-700', unread: true },
  { name: 'Ana Ruiz', msg: 'Do you have a Shopify app?', time: '18m', tone: 'bg-brand-100 text-brand-700', unread: false },
  { name: 'Theo Grant', msg: 'Perfect, that is all I needed', time: '1h', tone: 'bg-zinc-100 text-zinc-600', unread: false },
]

function Icon({ d, className = 'w-[18px] h-[18px]' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

function PanelCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200">
      <p className="border-b border-zinc-200 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-900">{title}</p>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  )
}

function AppMockup() {
  return (
    <div className="flex h-[480px] md:h-[560px] overflow-hidden rounded-[14px] border border-zinc-200 bg-page text-left select-none" aria-hidden>
      {/* Icon rail */}
      <div className="hidden sm:flex w-12 flex-shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-white py-3">
        {RAIL_ICONS.map((d, i) => (
          <span key={i} className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${i === 0 ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400'}`}>
            <Icon d={d} />
            {i === 1 && <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-semibold text-white">2</span>}
          </span>
        ))}
        <span className="mt-auto flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-700">DD</span>
      </div>

      {/* Conversation list */}
      <div className="flex w-full sm:w-[248px] flex-shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="px-3.5 pt-4 pb-2.5">
          <p className="text-[13px] font-semibold text-zinc-900">Inbox</p>
          <p className="text-[11px] text-zinc-400">Acme</p>
        </div>
        <div className="mx-3 flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[11px] text-zinc-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          Search name, email, or message…
        </div>
        <div className="mx-3 mt-2.5 flex items-center gap-1 text-[11px]">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white">All</span>
          <span className="px-2 py-0.5 text-zinc-500">Mine</span>
          <span className="px-2 py-0.5 text-zinc-500">Unassigned <span className="text-zinc-400">2</span></span>
        </div>
        <div className="mx-3 mt-2 grid grid-cols-4 rounded-lg bg-zinc-100 p-0.5 text-center text-[10.5px] text-zinc-500">
          <span className="rounded-md bg-white py-1 font-medium text-zinc-900 shadow-sm">All</span>
          <span className="py-1">Waiting <span className="rounded bg-brand-500 px-1 text-[9px] text-white">2</span></span>
          <span className="py-1">Open</span>
          <span className="py-1">Closed</span>
        </div>
        <div className="mt-2">
          {MOCK_CHATS.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-2.5 border-l-2 px-3 py-2.5 ${i === 0 ? 'border-l-zinc-900 bg-zinc-100' : 'border-l-transparent'}`}>
              <span className="relative flex-shrink-0">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${c.tone}`}>{c.name[0]}</span>
                {c.unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`truncate text-[12.5px] ${c.unread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-800'}`}>{c.name}</span>
                  <span className="ml-2 text-[10px] text-zinc-400">{c.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{c.msg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="hidden sm:flex min-w-0 flex-1 p-2.5">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">Maya Chen</p>
              <p className="text-[11px] text-zinc-500">Dana Demo ▾ <span className="text-zinc-400">· maya@example.com</span></p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live</span>
              <span className="rounded-lg bg-brand-500 px-3 py-1.5 text-[11.5px] font-medium text-white">Resolve</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 overflow-hidden bg-zinc-50/40 px-4 py-4">
            <div className="flex items-center gap-3 text-[10.5px] text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />Today<span className="h-px flex-1 bg-zinc-200" /></div>
            <div>
              <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[12.5px] text-zinc-800 ring-1 ring-zinc-200">
                Hi! Our invoice for October shows two charges, can you check?
              </div>
              <p className="mt-1 ml-1 text-[10px] text-zinc-400">07:35 PM</p>
            </div>
            <div className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3.5 py-2.5">
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-amber-600">Internal note · Dana Demo</p>
              <p className="text-[12.5px] text-amber-900">Second charge is from the old plan, refund it</p>
            </div>
            <div className="flex flex-col items-end">
              <p className="mb-1 mr-1 text-[10px] text-zinc-400">Dana Demo</p>
              <div className="max-w-[78%] rounded-2xl rounded-br-md bg-brand-500 px-3.5 py-2 text-[12.5px] text-white">
                Sorry about that, Maya. The second charge was your old plan. I have refunded it, so it will be back in 3 to 5 days.
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-200 px-3 pt-2 pb-3">
            <div className="mb-2 flex gap-1 text-[11px]">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-900">Reply</span>
              <span className="px-2 py-0.5 text-zinc-500">Internal Note</span>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-xl px-3 py-2.5 text-[12px] text-zinc-400 ring-1 ring-zinc-200">Reply to visitor… (Enter to send, / for saved replies)</div>
              <span className="rounded-lg bg-brand-500 px-3 py-2 text-[11.5px] font-medium text-white opacity-50">Send</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visitor panel */}
      <div className="hidden xl:flex w-[200px] flex-shrink-0 flex-col gap-2.5 py-2.5 pr-2.5">
        <PanelCard title="Visitor">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">M</span>
            <span className="text-[12.5px] font-semibold text-zinc-900">Maya Chen</span>
          </div>
          {[['Email', 'maya@example.com'], ['Browser', 'Chrome on macOS'], ['Started', 'Nov 5, 2026']].map(([k, v]) => (
            <div key={k} className="mt-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-zinc-400">{k}</p>
              <p className="text-[11.5px] text-zinc-700">{v}</p>
            </div>
          ))}
          <p className="mt-2.5 text-[9.5px] uppercase tracking-wider text-zinc-400">Status</p>
          <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700">open</span>
        </PanelCard>
        <PanelCard title="Pages viewed">
          <p className="text-[11px] text-zinc-600">/billing</p>
          <p className="mt-1 text-[11px] text-zinc-400">/account/invoices</p>
        </PanelCard>
        <PanelCard title="Tags">
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10.5px] text-zinc-700">billing</span>
        </PanelCard>
      </div>
    </div>
  )
}

// ─── Platforms strip ─────────────────────────────────────────────────────────

function Platforms() {
  const names = ['HTML', 'React', 'Next.js', 'Vue', 'WordPress', 'Shopify', 'Webflow', 'Framer', 'Svelte', 'Laravel']
  return (
    <section className="bg-[#090a0b] px-5 md:px-12 py-16">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
          <p className="text-zinc-900">Runs wherever you can paste a script tag. <span className="text-zinc-500">No SDK, no build step.</span></p>
          <Link to="/guide" className="text-zinc-500 hover:text-zinc-900 transition inline-flex items-center gap-1">
            Install guide <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-y-10">
          {names.map((n) => (
            <span key={n} className="text-center text-[22px] font-semibold tracking-[-0.03em] text-zinc-400">{n}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── What it does ────────────────────────────────────────────────────────────

function SystemDiagram() {
  const Node = ({ title, lines, dot }: { title: string; lines: string[]; dot?: boolean }) => (
    <div className="w-full max-w-[230px] rounded-xl border border-[#2a2a2a] bg-[#111] p-4">
      <p className="flex items-center gap-2 text-[14px] text-zinc-900">{dot && <Dot />}{title}</p>
      <div className="mt-3 space-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500">
        {lines.map((l) => <p key={l}>{l}</p>)}
      </div>
    </div>
  )
  const Wire = ({ label }: { label: string }) => (
    <div className="flex md:flex-1 flex-col items-center gap-2 py-2 md:py-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">{label}</span>
      <div className="relative h-8 w-px md:h-px md:w-full border-l md:border-l-0 md:border-t border-dashed border-zinc-300">
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 wire-pulse" />
      </div>
    </div>
  )
  return (
    <div className="grid-floor flex flex-col md:flex-row items-center gap-2 md:gap-4 px-6 md:px-10 py-14">
      <Node title="Your website" lines={['Widget · one tag', 'Welcome + quick replies', 'Pre-chat form']} />
      <Wire label="Visitor writes" />
      <Node title="Chatliox" dot lines={['Routes to an agent', 'Business hours', 'Stores the thread']} />
      <Wire label="Team answers" />
      <Node title="Your team" lines={['Shared inbox', 'Notes + saved replies', 'Ratings + analytics']} />
    </div>
  )
}

function WhatItDoes() {
  return (
    <section className="px-5 md:px-12 pt-24 pb-20">
      <p className="eyebrow">What it does</p>
      <TwoTone
        className="mt-6 max-w-[22ch] md:max-w-[30ch] text-[2.1rem] leading-[1.08] md:text-[3.1rem]"
        lead="Chatliox puts a chat on every page."
        rest="Your team answers every one of them from a single inbox."
      />
      <Figure className="mt-14" tl="Fig 0.1" tr="System" bl="Live over WebSocket" br="illustrative">
        <SystemDiagram />
      </Figure>
      <div className="mt-px grid md:grid-cols-2 border-t border-zinc-200">
        {[
          { title: 'The widget', body: 'One script tag. Visitors get a chat that greets them, answers quick questions and keeps the thread if they come back.' },
          { title: 'The inbox', body: 'Every chat lands in one place, with who is on it, how long they have waited and what the team said in private.' },
        ].map((c, i) => (
          <div key={c.title} className={`py-6 pr-6 ${i ? 'md:border-l md:border-zinc-200 md:pl-6' : ''}`}>
            <p className="flex items-center gap-2 text-[14px] text-zinc-900"><Dot className={i ? 'bg-emerald-500' : 'bg-zinc-900'} />{c.title}</p>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-zinc-500">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Big word + facts ────────────────────────────────────────────────────────

function Facts() {
  const works = ['HTML', 'React', 'Next', 'WP', 'Shopify', 'Webflow']
  return (
    <section id="about" className="px-5 md:px-12 pt-20 pb-24 scroll-mt-24">
      <div className="flex items-center justify-between text-[13px]">
        <p className="flex items-center gap-2 text-zinc-500"><span className="text-zinc-400">01</span><Dot /> Live chat for your site</p>
        <Link to="/register" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition">
          Create a workspace <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <p className="mt-10 text-[4.5rem] sm:text-[7rem] lg:text-[9rem] font-medium leading-[0.9] tracking-[-0.06em] text-zinc-900">
        Chatliox
      </p>
      <p className="mt-10 text-[1.5rem] md:text-[1.75rem] leading-[1.2] tracking-[-0.025em] text-zinc-900">
        For the team on the inbox,<br />
        <span className="text-zinc-400">and the people on your site.</span>
      </p>

      <dl className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.6fr] border-t border-zinc-200">
        <div className="py-6 pr-6">
          <dt className="eyebrow text-zinc-400">For</dt>
          <dd className="mt-4 text-[15px] text-zinc-900">Support and sales teams.</dd>
          <dd className="mt-1 text-[13px] text-zinc-400">No setup call needed.</dd>
        </div>
        <div className="py-6 sm:pl-6 sm:border-l border-zinc-200">
          <dt className="eyebrow text-zinc-400">Runs</dt>
          <dd className="mt-4 text-[15px] text-zinc-900">Hosted by us, or on your own servers with Docker.</dd>
        </div>
        <div className="py-6 lg:pl-6 lg:border-l border-zinc-200">
          <dt className="eyebrow text-zinc-400">Works with</dt>
          <dd className="mt-4 text-[15px] text-zinc-900">Any site that can load a script.</dd>
          <dd className="mt-5 flex flex-wrap gap-3">
            {works.map((w) => (
              <span key={w} className="flex flex-col items-center gap-1.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#262626] bg-[#141414] text-[10px] font-semibold text-zinc-700">
                  {w.slice(0, 2)}
                </span>
                <span className="text-[10.5px] text-zinc-400">{w}</span>
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </section>
  )
}

// ─── Feature grid ────────────────────────────────────────────────────────────

const FEATURES = [
  { title: 'Real-time', body: 'Messages and typing previews arrive over a live socket. No polling, no refresh.', stat: '<100ms', unit: 'delivery' },
  { title: 'Internal notes', body: 'Talk it over beside the chat. Notes are fenced off, so they never reach the visitor.', stat: 'Private', unit: 'by default' },
  { title: 'Saved replies', body: 'Type / for your answers. Macros reply, tag and resolve in one go.', stat: '1 key', unit: 'to insert' },
  { title: 'Routing', body: 'New chats go to whoever is free. Transfer with context when someone else knows better.', stat: 'Auto', unit: 'assignment' },
  { title: 'Business hours', body: 'Tell visitors when you are back, and set a reply target the team can see.', stat: 'SLA', unit: 'per workspace' },
  { title: 'Analytics', body: 'Chats per day, first reply time and how visitors rated each chat.', stat: '7 days', unit: 'at a glance' },
  { title: 'Engage', body: 'Welcome bubbles, quick replies and messages that open on the pages you pick.', stat: 'Proactive', unit: 'messages' },
  { title: 'Your look', body: 'Pick the colour and corner, swap in your own button, or restyle it with CSS.', stat: 'Custom', unit: 'CSS' },
]

function Features() {
  return (
    <section id="features" className="px-5 md:px-12 pt-24 pb-24 scroll-mt-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="eyebrow">Chatliox <span className="text-zinc-300">/</span> The inbox</p>
          <TwoTone
            className="mt-6 text-[2.1rem] leading-[1.08] md:text-[3.1rem]"
            lead="One inbox."
            rest="Everything the team needs to answer well."
          />
        </div>
        <p className="max-w-[32rem] text-[18px] md:text-[20px] leading-[1.42] tracking-[-0.012em] text-zinc-700">
          Built for the people answering chats all day. Fast to move through, clear about
          who is waiting, and quiet about everything else.
        </p>
      </div>

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="flex flex-col bg-black p-6 min-h-[248px]">
            <p className="font-mono text-[11px] text-zinc-400">{String(i + 1).padStart(2, '0')} <span className="text-zinc-300">/ 08</span></p>
            <h3 className="mt-5 text-[22px] font-medium tracking-[-0.03em] text-zinc-900">{f.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">{f.body}</p>
            <p className="mt-auto pt-6 flex items-baseline gap-2 border-t border-zinc-200/0">
              <span className="text-[24px] font-medium tracking-[-0.03em] text-zinc-900">{f.stat}</span>
              <span className="eyebrow text-[10.5px]">{f.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Install ─────────────────────────────────────────────────────────────────

function Install() {
  const snippet = `<!-- Add before </body> on every page -->
<script src="https://cdn.chatliox.io/widget.js"
        data-widget-key="YOUR_WIDGET_KEY" async></script>`

  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="install" className="px-5 md:px-12 pt-24 pb-24 scroll-mt-24">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">Chatliox <span className="text-zinc-300">/</span> Install</p>
          <TwoTone
            className="mt-6 text-[2.1rem] leading-[1.08] md:text-[3.1rem]"
            lead="One script tag."
            rest="Live in five minutes."
          />
          <ol className="mt-10 space-y-0 border-t border-zinc-200">
            {[
              ['Create a workspace', 'You get a widget key straight away.'],
              ['Paste the tag', 'Before </body>, on every page you want the chat.'],
              ['Answer from the inbox', 'Chats show up live. Invite the team with a link.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-5 border-b border-zinc-200 py-4">
                <span className="font-mono text-[11px] pt-1 text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[15px] text-zinc-900">{t}</p>
                  <p className="mt-0.5 text-[13px] text-zinc-500">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Figure tl="Fig 2.1" tr="index.html" bl="Paste once" br="async · ~10 KB">
          <div className="relative px-4 pt-6 pb-8">
            <button
              onClick={copy}
              className="absolute right-4 top-2 inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#141414] px-2.5 py-1 text-[11.5px] text-zinc-600 hover:text-zinc-900 transition"
            >
              {copied ? (<><Dot />Copied</>) : 'Copy'}
            </button>
            <pre className="mt-6 overflow-x-auto rounded-xl border border-[#1f1f1f] bg-black p-5 font-mono text-[12.5px] leading-relaxed text-zinc-700">
              <code>{snippet}</code>
            </pre>
          </div>
        </Figure>
      </div>
    </section>
  )
}

// ─── Proof ───────────────────────────────────────────────────────────────────

function Proof() {
  const cells = [
    { label: 'Delivery', big: '<100ms', body: 'From the visitor’s keyboard to your inbox over a live socket.' },
    { label: 'Notes', big: 'Private', body: 'Internal notes are stripped before anything reaches the widget.' },
    { label: 'Install', big: '1 tag', body: 'No SDK and no build step. Works on any stack.' },
    { label: 'Hosting', big: 'Yours', body: 'Use ours, or run the whole thing on your own servers.' },
  ]
  return (
    <section className="grid lg:grid-cols-[1.15fr_1fr] border-y border-zinc-200 bg-black">
      <div className="flex flex-col justify-between gap-12 p-8 md:p-12">
        <p className="text-[1.9rem] md:text-[2.4rem] font-medium leading-[1.12] tracking-[-0.035em] text-zinc-900 -indent-[0.45em]">
          “It does everything we actually used, live chat, internal notes and a team inbox, for a fraction of the cost.”
        </p>
        <div>
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
              alt="Sarah L."
              className="h-9 w-9 rounded-full object-cover grayscale"
            />
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face"
              alt="Marcus T."
              className="-ml-5 h-9 w-9 rounded-full object-cover grayscale ring-2 ring-black"
            />
            <div>
              <p className="text-[14px] text-zinc-900">Sarah L. &amp; Marcus T.</p>
              <p className="text-[12.5px] text-zinc-400">Co-founders, Shipfast</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 border-t lg:border-t-0 lg:border-l border-zinc-200">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={`p-7 md:p-8 border-zinc-200 ${i % 2 ? 'sm:border-l' : ''} ${i > 1 ? 'border-t' : i === 1 ? 'border-t sm:border-t-0' : ''}`}
          >
            <p className="eyebrow text-zinc-400">{c.label}</p>
            <p className="mt-5 text-[2rem] font-medium tracking-[-0.04em] text-zinc-900">{c.big}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Final call to action ────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="starfield relative overflow-hidden px-5 pt-32 pb-28 text-center">
      <StarField density={0.8} />
      <div className="relative">
      <p className="eyebrow">Get started</p>
      <h2 className="mx-auto mt-8 max-w-[14ch] text-[3rem] sm:text-[4.5rem] lg:text-[5.6rem] font-medium leading-[0.98] tracking-[-0.055em] text-zinc-900">
        Start talking to your visitors.
      </h2>
      <p className="mt-8 text-[17px] text-zinc-800">
        A workspace in two minutes. A chat on your site in five.
        <br />
        <span className="text-zinc-500">Invite the whole team with a single link.</span>
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
        <span className="hidden sm:flex items-center gap-2 mr-3 text-[13px] text-zinc-500"><Dot /> Ready in minutes</span>
        <Link to="/register" className="btn-pill btn-pill-lg">
          Create workspace
          <span className="btn-pill-chip"><ArrowUpRight /></span>
        </Link>
        <Link to="/login" className="btn-ghost btn-pill-lg">
          Sign in
          <span className="btn-pill-chip"><ArrowUpRight /></span>
        </Link>
      </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const cols: { head: string; links: { label: string; to: string }[] }[] = [
    { head: 'Product', links: [
      { label: 'Overview', to: '/#product' }, { label: 'Features', to: '/#features' },
      { label: 'Install', to: '/#install' },
    ] },
    { head: 'Resources', links: [{ label: 'Guide', to: '/guide' }, { label: 'Install the widget', to: '/guide' }] },
    { head: 'Account', links: [
      { label: 'Sign in', to: '/login' }, { label: 'Create workspace', to: '/register' },
      { label: 'Reset password', to: '/forgot-password' },
    ] },
  ]
  return (
    <footer className="bg-[#090a0b] border-t border-rail overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-6 pt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Logo className="h-4 w-auto" variant="dark" alt="" markOnly />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-900">Chatliox</span>
          </div>
          <p className="mt-3 max-w-[14rem] text-[13px] text-zinc-500">Live chat for your whole team.</p>
        </div>
        {cols.map((c) => (
          <div key={c.head}>
            <p className="eyebrow text-[10.5px] text-zinc-400">{c.head}</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-zinc-600">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.to.startsWith('/#')
                    ? <a href={l.to.slice(1)} className="hover:text-zinc-900 transition">{l.label}</a>
                    : <Link to={l.to} className="hover:text-zinc-900 transition">{l.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="dot-type mt-16 pb-10 select-none text-center text-[21vw] lg:text-[16rem] font-medium leading-[1.05] tracking-[-0.05em]" aria-hidden>
        Chatliox
      </p>
      <div className="border-t border-rail px-6 py-5 text-center text-[12px] text-zinc-400">
        © {new Date().getFullYear()} Chatliox
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [showTicker, setShowTicker] = useState(true)
  return (
    <div className="min-h-screen bg-black font-sans antialiased text-zinc-900">
      {showTicker && <Ticker onClose={() => setShowTicker(false)} />}
      <Nav />
      <main>
        <Hero />
        <Platforms />
        {/* Framed column: hairline rails left and right, crosses where sections meet. */}
        <div className="mx-3 md:mx-8 border-x border-rail">
          <WhatItDoes />
          <Divider />
          <Facts />
          <Divider />
          <Features />
          <Divider />
          <Install />
          <Proof />
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </div>
  )
}
