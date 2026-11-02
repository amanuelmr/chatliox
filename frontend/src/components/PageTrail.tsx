import { pageLabel, pagePath } from '@/lib/visitor'
import type { PageView } from '@/types/chat'

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// The pages a visitor moved through, newest first.
export default function PageTrail({ pages }: { pages: PageView[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Pages viewed</p>
        {pages.length > 0 && <span className="text-[11px] text-zinc-400 tabular-nums">{pages.length}</span>}
      </div>
      {pages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">No pages recorded for this chat.</p>
      ) : (
        <ol className="p-2 flex flex-col max-h-64 overflow-y-auto" aria-label="Pages viewed">
          {[...pages].reverse().map((page, i) => (
            <li key={`${page.at}-${page.url}`} className="px-2 py-1.5 rounded-lg hover:bg-zinc-50">
              <div className="flex items-baseline gap-2">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`text-xs truncate flex-1 hover:underline ${i === 0 ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}
                  title={page.url}
                >
                  {pageLabel(page)}
                </a>
                <span className="text-[10px] text-zinc-400 tabular-nums flex-shrink-0">{time(page.at)}</span>
              </div>
              {page.title && <p className="text-[11px] text-zinc-400 truncate">{pagePath(page.url)}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
