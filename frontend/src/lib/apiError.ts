import axios from 'axios'

// The API's own explanation when it gave one (FastAPI's `detail`), otherwise the fallback.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
  }
  return fallback
}
