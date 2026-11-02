import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '@/components/Logo'

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 h-14 border-b border-zinc-100/60 bg-white/80 backdrop-blur-md">
      <Logo className="h-8 w-auto" variant="brand" />
      <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-500">
        <a href="#features" className="hover:text-zinc-900 transition">Features</a>
        <a href="#developer" className="hover:text-zinc-900 transition">Developers</a>
        <Link to="/guide" className="hover:text-zinc-900 transition">Guide</Link>
      </nav>
      <div className="flex items-center gap-3">
        <Link to="/login" className="text-sm text-zinc-600 hover:text-zinc-900 transition font-medium">
          Log in
        </Link>
        <Link
          to="/register"
          className="text-sm bg-brand-500 hover:bg-brand-600 text-white font-medium px-4 py-1.5 rounded-lg transition"
        >
          Start for free
        </Link>
      </div>
    </header>
  )
}

// ─── App Mockup ──────────────────────────────────────────────────────────────

function AppMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-200 shadow-2xl shadow-zinc-200/60 bg-white flex h-[420px] select-none">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-zinc-100 bg-zinc-50 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-100">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Conversations</p>
        </div>
        {[
          { name: 'Alice Johnson', msg: 'How do I reset my password?', time: '2m', dot: 'bg-brand-500' },
          { name: 'Bob Chen', msg: 'My order never arrived…', time: '8m', dot: 'bg-brand-500' },
          { name: 'Sara Kim', msg: 'Thanks for your help!', time: '1h', dot: '' },
          { name: 'Dev Team', msg: 'Bug report: checkout fails', time: '3h', dot: '' },
        ].map((c, i) => (
          <div
            key={i}
            className={`px-3 py-2.5 flex items-start gap-2.5 border-b border-zinc-100/80 cursor-default ${i === 0 ? 'bg-white' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-800 truncate">{c.name}</span>
                <span className="text-[10px] text-zinc-400 flex-shrink-0 ml-1">{c.time}</span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">{c.msg}</p>
            </div>
            {c.dot && <div className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 flex-shrink-0`} />}
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-[10px] font-bold">A</div>
            <div>
              <p className="text-xs font-semibold text-zinc-800">Alice Johnson</p>
              <p className="text-[10px] text-zinc-400">Active now</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">Open</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 px-5 py-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-zinc-200 flex-shrink-0" />
            <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[60%]">
              <p className="text-[11px] text-zinc-700">How do I reset my password?</p>
            </div>
          </div>
          <div className="flex gap-2 items-end justify-end">
            <div className="bg-brand-500 rounded-2xl rounded-br-sm px-3 py-2 max-w-[65%]">
              <p className="text-[11px] text-white">Hi Alice! You can reset your password by clicking "Forgot password" on the login page.</p>
            </div>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex-shrink-0" />
          </div>
          <div className="self-center my-1">
            <div className="bg-amber-50 border border-dashed border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-[10px] text-amber-700 font-medium">Internal note · Check if account is locked out</p>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-zinc-200 flex-shrink-0" />
            <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-3 py-2">
              <p className="text-[11px] text-zinc-700">It says the link expired. Can you help?</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-zinc-100">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
            <p className="text-[11px] text-zinc-400 flex-1">Reply to Alice…</p>
            <button className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-32 pb-24 px-6 flex flex-col items-center text-center">
      <h1 className="font-display text-5xl md:text-[3.75rem] lg:text-[4.25rem] font-semibold tracking-[-0.03em] text-zinc-900 max-w-2xl leading-[1.08]">
        The live chat your{' '}
        <span className="text-brand-500">customers</span>{' '}
        will love
      </h1>
      <p className="mt-5 text-lg text-zinc-500 max-w-xl leading-relaxed">
        Embed a powerful support widget in minutes. One script tag. Real-time messaging.
        Internal notes for your team. No per-seat pricing.
      </p>
      <div className="mt-9 flex items-center gap-3 flex-wrap justify-center">
        <Link
          to="/register"
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm px-6 py-3 rounded-xl transition shadow-sm"
        >
          Start for free →
        </Link>
        <Link
          to="/guide"
          className="bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-medium text-sm px-6 py-3 rounded-xl transition"
        >
          Read the guide
        </Link>
      </div>
      <p className="mt-4 text-xs text-zinc-400">No credit card required · Self-host or managed</p>
      <div className="mt-16 w-full max-w-4xl">
        <AppMockup />
      </div>
    </section>
  )
}

function DeveloperSection() {
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
    <section id="developer" className="bg-zinc-900 py-24 px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">For developers</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
            Deploy in under five minutes
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Drop two lines of HTML into your page. Your customers get a live chat widget;
            your team gets a full inbox. No build steps, no SDK, no configuration hell.
          </p>
          <ul className="mt-7 flex flex-col gap-3">
            {[
              'One script tag — no npm install',
              'WebSocket-powered, sub-100ms messages',
              'Your widget key isolates data per workspace',
              'Self-host on your own infrastructure',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Code block */}
        <div className="relative rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/60">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-zinc-600" />
              <span className="w-3 h-3 rounded-full bg-zinc-600" />
              <span className="w-3 h-3 rounded-full bg-zinc-600" />
            </div>
            <button
              onClick={copy}
              className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="p-5 text-sm leading-relaxed overflow-x-auto text-zinc-300 font-mono">
            <code>{snippet}</code>
          </pre>
        </div>
      </div>
    </section>
  )
}

function FeatureGrid() {
  return (
    <section id="features" className="py-24 px-6 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-zinc-900 tracking-tight">Everything your team needs</h2>
          <p className="mt-3 text-zinc-500 max-w-lg mx-auto">
            Purpose-built for support teams. No bloated feature list — just the tools that matter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Wide card: WebSockets */}
          <div className="md:col-span-2 bg-white border border-zinc-200 rounded-2xl p-7 flex gap-8 items-center overflow-hidden">
            <div className="flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">Real-time, always</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Every message travels over a persistent WebSocket. Customers see replies instantly.
                Agents see typing indicators before the message even arrives. No polling, no refresh.
              </p>
            </div>
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0 w-52">
              {['Typing indicators', 'Sub-100ms delivery', 'Offline queue', 'Auto-reconnect'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-zinc-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Multi-tenant */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-7">
            <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Multi-tenant workspaces</h3>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Every organization gets a unique widget key and isolated data. Invite teammates with a
              single link — no IT tickets required.
            </p>
          </div>

          {/* Internal notes */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-7">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Internal notes</h3>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Leave private notes for your team — never visible to the customer. Dashed amber
              styling makes them impossible to accidentally send.
            </p>
          </div>

          {/* Wide card: Team roles */}
          <div id="team" className="md:col-span-2 bg-white border border-zinc-200 rounded-2xl p-7 flex gap-8 items-center">
            <div className="flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">Team roles — no per-seat pricing</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Add as many agents as you need. Admins manage the workspace; agents handle conversations.
                Role changes take effect instantly with no restart or re-login.
              </p>
            </div>
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0">
              {[
                { role: 'Admin', color: 'bg-violet-100 text-violet-700' },
                { role: 'Agent', color: 'bg-zinc-100 text-zinc-600' },
              ].map(({ role, color }) => (
                <div key={role} className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>{role}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        <svg className="w-8 h-8 text-zinc-200 mx-auto mb-6" fill="currentColor" viewBox="0 0 32 32">
          <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
        </svg>
        <p className="text-xl md:text-2xl font-medium text-zinc-800 leading-relaxed">
          "We replaced Intercom after our bill hit $2,400 a month. Chatliox does everything
          we actually used — live chat, internal notes, team inbox — for a fraction of the cost."
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
            alt="Sarah L."
            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
          />
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face"
            alt="Marcus T."
            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow -ml-3"
          />
          <div className="ml-1 text-left">
            <p className="text-sm font-semibold text-zinc-800">Sarah L. &amp; Marcus T.</p>
            <p className="text-xs text-zinc-400">Co-founders, Shipfast</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24 px-6 bg-zinc-900">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
          Ready to talk to your customers?
        </h2>
        <p className="mt-4 text-zinc-400">
          Set up your workspace in two minutes. No credit card. No vendor lock-in.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/register"
            className="bg-white hover:bg-zinc-100 text-zinc-900 font-medium text-sm px-7 py-3 rounded-xl transition shadow"
          >
            Create workspace →
          </Link>
          <Link
            to="/login"
            className="text-zinc-400 hover:text-white text-sm font-medium transition"
          >
            Sign in to existing workspace
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-8 bg-white">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
        <Logo className="h-7 w-auto" variant="dark" />
        <div className="flex gap-6">
          <Link to="/login" className="hover:text-zinc-600 transition">Log in</Link>
          <Link to="/register" className="hover:text-zinc-600 transition">Sign up</Link>
          <a href="#features" className="hover:text-zinc-600 transition">Features</a>
          <Link to="/guide" className="hover:text-zinc-600 transition">Guide</Link>
        </div>
        <p>© {new Date().getFullYear()} Chatliox. All rights reserved.</p>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="font-sans antialiased text-zinc-900">
      <Nav />
      <main className="pt-0">
        <Hero />
        <DeveloperSection />
        <FeatureGrid />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
