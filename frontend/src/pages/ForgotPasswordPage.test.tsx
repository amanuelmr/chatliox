import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { forgotPassword } from '@/api/auth'
import { renderAt } from '@/test/render'
import ForgotPasswordPage from './ForgotPasswordPage'

vi.mock('@/api/auth', () => ({ forgotPassword: vi.fn() }))

async function submit(email: string) {
  renderAt(<ForgotPasswordPage />)
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), email)
  await userEvent.click(screen.getByRole('button', { name: /send/i }))
}

describe('ForgotPasswordPage', () => {
  it('confirms once the email is on its way', async () => {
    vi.mocked(forgotPassword).mockResolvedValueOnce(undefined)
    await submit('pat@example.com')
    expect(await screen.findByText(/we've sent a link/i)).toBeInTheDocument()
  })

  it("shows the server's reason instead of pretending it worked", async () => {
    const config = { headers: new AxiosHeaders() }
    vi.mocked(forgotPassword).mockRejectedValueOnce(
      new AxiosError('failed', 'ERR', config, null, {
        status: 503,
        statusText: '',
        headers: {},
        config,
        data: { detail: "Email isn't set up on this server yet" },
      }),
    )
    await submit('pat@example.com')
    expect(await screen.findByText("Email isn't set up on this server yet")).toBeInTheDocument()
    expect(screen.queryByText(/we've sent a link/i)).not.toBeInTheDocument()
  })
})
