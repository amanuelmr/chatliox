import type { PageView } from './chat'

// Someone with the widget loaded on the site right now.
export interface LiveVisitor {
  visitor_id: string
  arrived_at: string
  user_agent: string | null
  referrer: string | null
  // Oldest first; the last one is the page they're on now.
  pages: PageView[]
}
