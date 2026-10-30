// WebSockets always go straight to the API — the Vite dev server has no proxy,
// so deriving the host from window.location only works when both share an origin.
export function apiWsUrl(path: string): string {
  const apiUrl = import.meta.env.VITE_API_URL as string
  const proto = apiUrl.startsWith('https:') ? 'wss:' : 'ws:'
  return `${proto}//${apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}${path}`
}
