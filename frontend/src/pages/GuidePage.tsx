import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '@/components/Logo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Section {
  id: string
  label: string
  subsections?: { id: string; label: string }[]
}

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview' },
  {
    id: 'getting-started',
    label: 'Getting started',
    subsections: [
      { id: 'create-workspace', label: 'Create a workspace' },
      { id: 'invite-team', label: 'Invite your team' },
    ],
  },
  {
    id: 'embed',
    label: 'Embed the widget',
    subsections: [
      { id: 'find-widget-key', label: 'Find your widget key' },
      { id: 'add-script', label: 'Add the script tag' },
      { id: 'verify', label: 'Verify it works' },
      { id: 'own-button', label: 'Your own button and CSS' },
    ],
  },
  {
    id: 'inbox',
    label: 'Using the inbox',
    subsections: [
      { id: 'conversations', label: 'Conversations' },
      { id: 'reply', label: 'Replying to customers' },
      { id: 'resolve', label: 'Resolving conversations' },
      { id: 'internal-notes', label: 'Internal notes' },
    ],
  },
  {
    id: 'team',
    label: 'Team management',
    subsections: [
      { id: 'roles', label: 'Roles: Admin vs Agent' },
      { id: 'manage-members', label: 'Managing members' },
      { id: 'rotate-invite', label: 'Rotating the invite link' },
    ],
  },
  { id: 'widget-experience', label: 'Customer widget' },
  { id: 'faq', label: 'FAQ' },
]

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-zinc-100 py-8 pr-6">
      <nav className="flex flex-col gap-0.5">
        {SECTIONS.map((s) => (
          <div key={s.id}>
            <a
              href={`#${s.id}`}
              className={`block px-2 py-1 rounded text-sm transition font-medium ${
                active === s.id ? 'text-brand-500 bg-brand-50' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {s.label}
            </a>
            {s.subsections?.map((sub) => (
              <a
                key={sub.id}
                href={`#${sub.id}`}
                className={`block pl-4 pr-2 py-0.5 rounded text-[13px] transition ${
                  active === sub.id ? 'text-brand-500' : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                {sub.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── Shared content components ────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-semibold text-zinc-900 mt-14 mb-4 scroll-mt-20">
      {children}
    </h2>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-zinc-800 mt-8 mb-2 scroll-mt-20">
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-zinc-600 leading-relaxed mb-3">{children}</p>
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3 my-4">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-50 border border-brand-100 text-brand-500 text-xs font-semibold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span
            className="text-[15px] text-zinc-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: step }}
          />
        </li>
      ))}
    </ol>
  )
}

function Callout({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) {
  const styles = {
    tip: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-brand-50 border-brand-100 text-brand-700',
  }
  const icons = {
    tip: (
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  }
  return (
    <div className={`flex gap-2.5 border rounded-xl px-4 py-3 my-4 text-sm leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <span>{children}</span>
    </div>
  )
}

function CodeBlock({ code, language = 'html' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative my-4 rounded-xl bg-zinc-900 overflow-hidden border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
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
      <pre className="p-4 text-sm leading-relaxed overflow-x-auto text-zinc-300 font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

function Content() {
  return (
    <article className="flex-1 min-w-0 py-8 px-2 max-w-2xl">

      {/* Overview */}
      <div id="overview" className="scroll-mt-20">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Guide</p>
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">Using Chatliox</h1>
        <p className="mt-3 text-[15px] text-zinc-500 leading-relaxed">
          Chatliox is a real-time live chat platform. You embed a small widget on your website;
          customers can start a conversation from any page. Your team handles those conversations
          from a shared inbox, using internal notes to coordinate behind the scenes.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          {[
            { icon: '🏗️', title: 'Set up', desc: 'Create workspace, embed widget' },
            { icon: '💬', title: 'Respond', desc: 'Manage conversations, write notes' },
            { icon: '👥', title: 'Scale', desc: 'Add agents, manage roles' },
          ].map((c) => (
            <div key={c.title} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
              <p className="text-lg mb-1">{c.icon}</p>
              <p className="text-sm font-semibold text-zinc-800">{c.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Getting started */}
      <SectionHeading id="getting-started">Getting started</SectionHeading>

      <SubHeading id="create-workspace">Create a workspace</SubHeading>
      <P>
        A workspace is your organization's private environment — it contains your conversations,
        teammates, and widget key. One workspace per company is typical.
      </P>
      <StepList steps={[
        'Go to <strong>/register</strong> and fill in your full name, work email, password, and workspace name.',
        'Hit <strong>Create workspace</strong>. You\'ll be signed in immediately and land on the Welcome screen.',
        'The Welcome screen shows your widget key and embed snippet. You can also find these later in Settings.',
      ]} />
      <Callout type="tip">
        The first user to register a workspace automatically gets the <strong>Admin</strong> role.
        Everyone invited afterward gets the <strong>Agent</strong> role by default.
      </Callout>

      <SubHeading id="invite-team">Invite your team</SubHeading>
      <P>
        Chatliox uses shareable invite links — no email infrastructure required. Anyone with the
        link can join your workspace as an Agent.
      </P>
      <StepList steps={[
        'Open the admin dashboard and click the <strong>gear icon</strong> (Settings) in the left nav.',
        'Under <em>Invite teammates</em>, copy the invite URL.',
        'Share the URL with your teammates. They\'ll fill in their name, email, and password, then land directly in the inbox.',
        'To prevent old links from working, click <strong>Rotate link</strong> — all previous invite URLs are immediately invalidated.',
      ]} />
      <Callout type="warning">
        Only Admins can see the Settings pane and rotate the invite link. If the gear icon is
        missing, ask your workspace Admin to send you the invite.
      </Callout>

      {/* Embed */}
      <SectionHeading id="embed">Embed the widget</SectionHeading>

      <SubHeading id="find-widget-key">Find your widget key</SubHeading>
      <P>
        Your widget key identifies your workspace. Every message sent through your widget is
        routed to your inbox — and only yours.
      </P>
      <StepList steps={[
        'Log in and open the dashboard.',
        'Click the <strong>&lt;/&gt; icon</strong> in the left nav. It copies the full install snippet, widget key included.',
      ]} />

      <SubHeading id="add-script">Add the script tag</SubHeading>
      <P>Paste this just before <code className="text-[13px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700">&lt;/body&gt;</code> on every page where you want the chat widget to appear.</P>
      <CodeBlock code={`<script src="https://cdn.chatliox.io/widget.js"
        data-widget-key="YOUR_WIDGET_KEY" async></script>`} language="html" />
      <P>
        Replace <code className="text-[13px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700">YOUR_WIDGET_KEY</code> with the key from Settings.
        That's it — the widget loads automatically and floats in the bottom-right corner.
      </P>
      <Callout type="info">
        The widget is loaded asynchronously so it never blocks your page render. First paint is
        unaffected even on slow connections.
      </Callout>

      <SubHeading id="verify">Verify it works</SubHeading>
      <StepList steps={[
        'Open your site in a browser. A chat bubble should appear in the bottom-right corner.',
        'Click the bubble and send a test message.',
        'Switch to the Chatliox admin dashboard — the conversation should appear in the inbox within a second.',
        'Reply from the dashboard. You should see it appear in the widget instantly, over WebSocket.',
      ]} />
      <Callout type="tip">
        If the widget doesn't appear, open your browser DevTools console and look for errors
        mentioning <code className="font-mono">chatliox</code>. A 401 error usually means the
        widget key was copied incorrectly.
      </Callout>

      <SubHeading id="own-button">Your own button and CSS</SubHeading>
      <P>
        In Settings → Widget you can put the chat button in any corner, show it on computers only,
        or hide it completely. Then open the chat from anything on your site, such as a link in your
        mobile menu, by adding one attribute:
      </P>
      <CodeBlock code={`<a href="#" data-chatliox-open>Chat with us</a>
<!-- also: data-chatliox-close, data-chatliox-toggle -->
<!-- or from JavaScript: window.chatliox.open() / close() / toggle() -->`} language="html" />
      <P>
        The <strong>Custom CSS</strong> box in the same place restyles anything: the button, the
        unread badge, the chat window and the messages inside it. Our default styles never win over
        yours, so you don't need <code className="text-[13px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700">!important</code>.
      </P>
      <CodeBlock code={`/* A square button that sits higher on phones */
.chatliox-launcher { border-radius: 14px; }
@media (max-width: 640px) {
  .chatliox { --chatliox-offset-y: 88px; }
}`} language="css" />

      {/* Inbox */}
      <SectionHeading id="inbox">Using the inbox</SectionHeading>

      <SubHeading id="conversations">Conversations</SubHeading>
      <P>
        The left panel lists every conversation, newest first. Unread ones show a blue dot.
        Click any row to open it in the chat window on the right.
      </P>
      <P>
        Each conversation belongs to a single visitor session. If the same customer starts a
        new chat on a different day without a session cookie, it creates a new conversation.
      </P>

      <SubHeading id="reply">Replying to customers</SubHeading>
      <StepList steps={[
        'Click a conversation in the list.',
        'Type your message in the input at the bottom. Press <strong>Enter</strong> or click the send button.',
        'The customer sees your reply instantly in the widget — no page refresh needed.',
        'The agent\'s name appears on messages in the widget so customers know who they\'re talking to.',
      ]} />

      <SubHeading id="resolve">Resolving conversations</SubHeading>
      <P>
        When an issue is solved, mark the conversation resolved. This moves it out of the active
        queue and lets your team focus on open work.
      </P>
      <StepList steps={[
        'Open the conversation.',
        'Click the <strong>Resolve</strong> button in the top-right of the chat window.',
        'The conversation status changes to <em>Resolved</em> and a green banner appears in the customer\'s widget.',
        'If the customer replies after resolution, the conversation automatically reopens and you get it back in the inbox.',
      ]} />
      <Callout type="info">
        Automatic reopening on customer reply is intentional — it matches the Intercom/Freshchat
        standard so customers don't need to start a new thread for the same issue.
      </Callout>

      <SubHeading id="internal-notes">Internal notes</SubHeading>
      <P>
        Internal notes are team-only messages that are <strong>never shown to the customer</strong>.
        Use them to hand off context between teammates, flag account details, or leave reminders.
      </P>
      <StepList steps={[
        'In the conversation input bar, click the <strong>Internal Note</strong> tab.',
        'The entire input area turns amber — a strong visual cue that this won\'t go to the customer.',
        'Type your note and send. It appears in the conversation thread as a dashed amber block.',
        'Switch back to the <strong>Reply</strong> tab to resume the customer conversation.',
      ]} />
      <Callout type="warning">
        The amber input wash and dashed border exist specifically to prevent accidental sends —
        a common frustration in other help desks. If you see amber, you're in note mode.
      </Callout>

      {/* Team */}
      <SectionHeading id="team">Team management</SectionHeading>

      <SubHeading id="roles">Roles: Admin vs Agent</SubHeading>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left py-2 pr-6 font-medium text-zinc-500 text-xs uppercase tracking-wide">Capability</th>
              <th className="text-center py-2 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">Admin</th>
              <th className="text-center py-2 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">Agent</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['View & reply to conversations', true, true],
              ['Write internal notes', true, true],
              ['Resolve conversations', true, true],
              ['See Settings pane', true, false],
              ['Invite teammates', true, false],
              ['Rotate invite link', true, false],
              ['Change member roles', true, false],
              ['Remove members', true, false],
            ].map(([cap, admin, agent]) => (
              <tr key={cap as string} className="border-b border-zinc-50">
                <td className="py-2 pr-6 text-zinc-600">{cap as string}</td>
                <td className="text-center py-2 px-4">
                  {admin ? (
                    <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="text-zinc-200">—</span>
                  )}
                </td>
                <td className="text-center py-2 px-4">
                  {agent ? (
                    <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="text-zinc-200">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHeading id="manage-members">Managing members</SubHeading>
      <StepList steps={[
        'Go to <strong>Settings → Team members</strong> (gear icon in the left nav).',
        'Each member row shows their name, email, and a role dropdown.',
        'To promote an Agent to Admin: open their role dropdown and select <strong>Admin</strong>.',
        'To remove a member: click the <strong>✕</strong> button on their row. They\'ll be deactivated immediately.',
      ]} />
      <Callout type="warning">
        You cannot demote or remove yourself if you are the only Admin — this prevents workspaces
        from becoming admin-less. Promote another member first, then demote yourself if needed.
      </Callout>

      <SubHeading id="rotate-invite">Rotating the invite link</SubHeading>
      <P>
        If your invite link is accidentally shared publicly or you want to stop accepting new
        members temporarily, rotate it. The old URL becomes a 404 immediately.
      </P>
      <StepList steps={[
        'Open Settings (gear icon).',
        'Under <em>Invite teammates</em>, click <strong>Rotate link</strong>.',
        'A new URL is generated. Copy and share the new link with anyone who still needs to join.',
      ]} />

      {/* Widget experience */}
      <SectionHeading id="widget-experience">Customer widget</SectionHeading>
      <P>
        From your customer's perspective, the widget is a small chat bubble in the corner of
        your site. Here's what they experience:
      </P>
      <ul className="flex flex-col gap-2 my-4 pl-1">
        {[
          '<strong>Starting a chat</strong> — click the bubble, type a message, hit send. No login required.',
          '<strong>Real-time replies</strong> — your agent\'s responses appear instantly with the agent\'s name.',
          '<strong>Resolved conversations</strong> — a green banner reads "This conversation was resolved." The input stays active; sending a new message automatically reopens the conversation.',
          '<strong>Typing indicators</strong> — customers see when an agent is typing.',
          '<strong>Persistent history</strong> — the conversation history is preserved for the session so customers don\'t lose context if they navigate between pages.',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] text-zinc-600">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-2 flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>

      {/* FAQ */}
      <SectionHeading id="faq">FAQ</SectionHeading>
      {[
        {
          q: 'Can I use Chatliox on multiple domains?',
          a: 'Yes. The same widget key works across any number of domains. All conversations from all domains land in the same inbox.',
        },
        {
          q: 'Is there a per-seat charge for adding agents?',
          a: 'No. You can add as many agents as you need at no extra cost. The goal is to get your whole team in without budget arguments.',
        },
        {
          q: 'What happens if no agent is online?',
          a: "The visitor's message is stored. When an agent logs in and opens the conversation, they'll see the full history and can reply normally.",
        },
        {
          q: 'Can customers see internal notes?',
          a: 'Never. Internal notes are filtered out before any message is sent to the widget. Even if someone inspects the API response, notes are excluded.',
        },
        {
          q: 'How do I self-host Chatliox?',
          a: 'The backend is a FastAPI app with a PostgreSQL database. Clone the repo, set the environment variables (database URL, SMTP, allowed origins), run the Alembic migrations, and start the server. The frontend can be built with `npm run build` and served as static files.',
        },
      ].map(({ q, a }) => (
        <div key={q} className="border-b border-zinc-100 py-4">
          <p className="text-sm font-semibold text-zinc-800">{q}</p>
          <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{a}</p>
        </div>
      ))}

      <div className="mt-14 pt-8 border-t border-zinc-100 flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-700 transition flex items-center gap-1.5">
          ← Back to home
        </Link>
        <Link
          to="/register"
          className="text-sm bg-brand-500 hover:bg-brand-600 text-white font-medium px-5 py-2 rounded-lg transition"
        >
          Get started →
        </Link>
      </div>
    </article>
  )
}

// ─── Active section tracker ───────────────────────────────────────────────────

function useActiveSection() {
  const [active, setActive] = useState('overview')

  useEffect(() => {
    const allIds: string[] = []
    SECTIONS.forEach((s) => {
      allIds.push(s.id)
      s.subsections?.forEach((sub) => allIds.push(sub.id))
    })

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )

    allIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return active
}

// ─── Page ────────────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 h-14 border-b border-zinc-100 bg-white/90 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Logo className="h-8 w-auto" variant="brand" />
        </Link>
        <span className="text-zinc-200">/</span>
        <span className="text-sm text-zinc-500">Guide</span>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition font-medium">
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

export default function GuidePage() {
  const active = useActiveSection()

  return (
    <div className="font-sans antialiased text-zinc-900">
      <TopNav />
      <div className="pt-14 max-w-5xl mx-auto flex gap-10 px-6">
        <Sidebar active={active} />
        <Content />
      </div>
    </div>
  )
}
