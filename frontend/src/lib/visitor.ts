import type { PageView } from '@/types/chat'

const BROWSERS: [string, RegExp][] = [
  ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+)(?:\.\d+)*.*Safari/],
]

const SYSTEMS: [string, RegExp][] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['Windows', /Windows NT/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
]

// "Chrome 130 on macOS", from a browser's user agent string. Order matters:
// Edge and Opera also claim to be Chrome, and Chrome also claims to be Safari.
export function describeBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null
  const browser = BROWSERS.map(([name, re]) => {
    const match = userAgent.match(re)
    return match ? `${name} ${match[1]}` : null
  }).find(Boolean)
  const system = SYSTEMS.find(([, re]) => re.test(userAgent))?.[0]
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? null
}

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

// The part of the address that tells pages of one site apart.
export function pagePath(url: string): string {
  const parsed = parse(url)
  return parsed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : url
}

export function pageLabel(page: PageView): string {
  return page.title || pagePath(page.url)
}

export function siteName(url: string): string {
  return parse(url)?.hostname.replace(/^www\./, '') ?? url
}
