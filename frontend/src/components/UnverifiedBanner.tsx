import { useState } from 'react'
import { resendVerification } from '@/api/auth'

export default function UnverifiedBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleResend = () => {
    setSending(true)
    resendVerification(email)
      .then(() => setSent(true))
      .finally(() => setSending(false))
  }

  return (
    <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="text-amber-800">
        Please verify <strong>{email}</strong> — we sent a confirmation link to your inbox.
      </span>
      {sent ? (
        <span className="text-amber-700 font-medium">Sent — check your inbox</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending}
          className="text-amber-900 font-medium underline decoration-amber-400 hover:decoration-amber-600 disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
      )}
    </div>
  )
}
