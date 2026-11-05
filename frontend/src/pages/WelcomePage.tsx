import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuthStore } from '@/store/authStore'

export default function WelcomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [copied, setCopied] = useState(false)

  const widgetKey = user?.organization?.widget_key ?? ''
  const inviteToken = user?.organization?.invite_token ?? ''

  const embedCode = widgetKey
    ? `<script src="${window.location.origin}/widget.js" data-widget-key="${widgetKey}" async><\/script>`
    : ''

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    })
  }

  const inviteUrl = `${window.location.origin}/join/${inviteToken}`

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-5" variant="dark" />
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 text-center">
            Workspace created!
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 text-center">
            Welcome to <span className="font-medium text-gray-700">{user?.organization?.name}</span>. Here's how to get started.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Step 1 */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">1</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Install the chat widget</p>
                <p className="text-xs text-gray-500 mt-1 mb-3">Paste this snippet before the closing &lt;/body&gt; tag on your website.</p>
                <button
                  onClick={copyEmbed}
                  className={`w-full text-sm font-medium py-2.5 rounded-xl ring-1 transition-all duration-200 ${
                    copied
                      ? 'ring-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'ring-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  {copied ? '✓ Embed code copied!' : 'Copy widget snippet'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">2</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Invite your team</p>
                <p className="text-xs text-gray-500 mt-1 mb-3">Share this link with teammates so they can join your workspace.</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteUrl}
                    className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 outline-none select-all"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteUrl)}
                    className="flex-shrink-0 text-xs font-medium px-3 py-2 rounded-lg ring-1 ring-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Go to dashboard */}
          <div className="p-6">
            <button
              onClick={() => navigate('/app')}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-xl py-3 transition-all duration-200"
            >
              Go to dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
