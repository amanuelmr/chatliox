/*
 * Chatliox embeddable widget loader.
 *
 * Usage:
 *   <script src="https://your-chatliox-frontend.com/widget.js" data-widget-key="YOUR_WIDGET_KEY" async></script>
 *
 * That's it — launcher position, icon, color, size and offsets are all controlled
 * from the Chatliox dashboard (Settings → Widget appearance), so integrators never
 * need to edit this snippet to match their site.
 *
 * Optional attributes, for when a page needs to override the dashboard setting:
 *   data-position="left|right" (pins the launcher to one side regardless of dashboard config)
 * Optional pre-load config (set before this script runs):
 *   window.chatlioxSettings = { widgetKey: '...', position: 'right' }
 *
 * Exposes window.chatliox = { open(), close(), toggle() } for programmatic control.
 *
 * The loader also tells the widget which page the visitor is on, including
 * client-side navigation in single-page apps, so the team can see it in the dashboard.
 */
(function () {
  if (window.chatliox && window.chatliox.__loaded) return

  var CURRENT_SCRIPT = document.currentScript
  if (!CURRENT_SCRIPT) return

  var FRONTEND_ORIGIN = new URL(CURRENT_SCRIPT.src).origin
  var settings = window.chatlioxSettings || {}
  var widgetKey = CURRENT_SCRIPT.getAttribute('data-widget-key') || settings.widgetKey
  if (!widgetKey) {
    console.error('[Chatliox] Missing widget key. Add data-widget-key to the <script> tag.')
    return
  }

  // A script-tag/settings position is an explicit override that wins over whatever
  // the dashboard has configured; otherwise the org's dashboard setting applies once loaded.
  var explicitPositionAttr = CURRENT_SCRIPT.getAttribute('data-position') || settings.position
  var explicitPosition = explicitPositionAttr === 'left' || explicitPositionAttr === 'right' ? explicitPositionAttr : null

  var MSG_SOURCE_WIDGET = 'chatliox-widget'
  var MSG_SOURCE_LOADER = 'chatliox-loader'

  var CHAT_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3 12.75c0 1.6 1.123 2.994 2.707 3.227A48 48 0 0 0 9 16.35V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48 48 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.227V6.741c0-1.602-1.123-2.995-2.707-3.228A48 48 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.009Z" /></svg>'
  var CLOSE_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>'

  var isOpen = false
  var unreadCount = 0
  var brandColor = '#4f6ef7'

  // Layout defaults — reconciled with the org's dashboard settings once the widget
  // iframe reports in via the 'ready' message. Kept here so the launcher renders
  // instantly instead of waiting on the iframe to load.
  var side = explicitPosition || 'right'
  var width = 376
  var height = 600
  var offsetX = 20
  var offsetY = 20
  var iconUrl = null

  var iframe = document.createElement('iframe')
  iframe.src = FRONTEND_ORIGIN + '/widget?key=' + encodeURIComponent(widgetKey) + '&embed=1'
  iframe.title = 'Chat widget'
  iframe.setAttribute('allow', 'clipboard-write')
  iframe.style.cssText = [
    'position:fixed',
    'max-height:calc(100vh - 120px)',
    'max-width:calc(100vw - 40px)',
    'border:none',
    'border-radius:16px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.2)',
    'z-index:2147483000',
    'opacity:0',
    'pointer-events:none',
    'transform:translateY(12px) scale(0.98)',
    'transition:opacity 160ms ease,transform 160ms ease',
    'color-scheme:light',
  ].join(';')
  document.body.appendChild(iframe)

  var bubble = document.createElement('button')
  bubble.type = 'button'
  bubble.setAttribute('aria-label', 'Open chat')
  bubble.style.cssText = [
    'position:fixed',
    'width:56px',
    'height:56px',
    'border-radius:50%',
    'border:none',
    'background:' + brandColor,
    'color:#fff',
    'cursor:pointer',
    'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
    'z-index:2147483001',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'transition:transform 150ms ease,background 150ms ease',
    // Shown once the widget confirms the team's display rules allow this page.
    'visibility:hidden',
  ].join(';')
  bubble.addEventListener('mouseenter', function () { bubble.style.transform = 'scale(1.06)' })
  bubble.addEventListener('mouseleave', function () { bubble.style.transform = 'scale(1)' })
  document.body.appendChild(bubble)

  var badge = document.createElement('span')
  badge.style.cssText = [
    'position:absolute',
    'top:-2px',
    'min-width:18px',
    'height:18px',
    'padding:0 4px',
    'border-radius:9px',
    'background:#ef4444',
    'color:#fff',
    'font:600 11px/18px system-ui,sans-serif',
    'text-align:center',
    'display:none',
    'box-shadow:0 0 0 2px #fff',
  ].join(';')

  function updateBadge() {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
      badge.style.display = 'block'
    } else {
      badge.style.display = 'none'
    }
  }

  // Renders the launcher's icon: the close glyph while open, the org's custom
  // icon image when set, otherwise the built-in chat glyph. Uses DOM APIs rather
  // than string-built HTML for the custom icon since iconUrl is untrusted input.
  function renderBubbleIcon() {
    while (bubble.firstChild) bubble.removeChild(bubble.firstChild)
    if (isOpen) {
      bubble.innerHTML = CLOSE_ICON
    } else if (iconUrl) {
      var img = document.createElement('img')
      img.alt = ''
      img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;pointer-events:none'
      img.onerror = function () {
        iconUrl = null
        renderBubbleIcon()
      }
      img.src = iconUrl
      bubble.appendChild(img)
    } else {
      bubble.innerHTML = CHAT_ICON
    }
    bubble.appendChild(badge)
  }

  // Re-applies side/size/offsets to the iframe and bubble. Called on init and
  // again whenever the widget iframe reports the org's dashboard settings.
  function applyLayout() {
    var other = side === 'left' ? 'right' : 'left'

    iframe.style.width = width + 'px'
    iframe.style.height = height + 'px'
    iframe.style.bottom = (offsetY + 56 + 16) + 'px'
    iframe.style[side] = offsetX + 'px'
    iframe.style[other] = ''
    iframe.style.transformOrigin = 'bottom ' + side

    bubble.style.bottom = offsetY + 'px'
    bubble.style[side] = offsetX + 'px'
    bubble.style[other] = ''

    badge.style[other] = '-2px'
    badge.style[side] = ''

    teaser.style.bottom = (offsetY + 56 + 12) + 'px'
    teaser.style[side] = offsetX + 'px'
    teaser.style[other] = ''

    renderBubbleIcon()
  }

  // A proactive message from the team, shown above the launcher while the chat
  // is closed. Clicking it opens the chat; the × dismisses it.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var teaser = document.createElement('div')
  teaser.setAttribute('role', 'button')
  teaser.setAttribute('tabindex', '0')
  teaser.style.cssText = [
    'position:fixed',
    'box-sizing:border-box',
    'width:280px',
    'max-width:calc(100vw - 40px)',
    'padding:14px 36px 14px 14px',
    'display:none',
    'gap:12px',
    'align-items:flex-start',
    'background:#fff',
    'color:#27272a',
    'border-radius:16px',
    'box-shadow:0 12px 32px rgba(0,0,0,0.16),0 0 0 1px rgba(0,0,0,0.05)',
    'font:14px/1.4 system-ui,-apple-system,sans-serif',
    'cursor:pointer',
    'z-index:2147483001',
    'opacity:0',
    'transform:translateY(8px)',
    'transition:' + (reduceMotion ? 'none' : 'opacity 220ms ease,transform 220ms ease'),
  ].join(';')

  var teaserAvatar = document.createElement('span')
  teaserAvatar.style.cssText =
    'flex:none;width:32px;height:32px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px'
  var teaserBody = document.createElement('span')
  teaserBody.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:2px'
  var teaserName = document.createElement('span')
  teaserName.style.cssText = 'font-size:11px;color:#a1a1aa'
  var teaserText = document.createElement('span')
  teaserText.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere'
  teaserBody.appendChild(teaserName)
  teaserBody.appendChild(teaserText)

  var teaserClose = document.createElement('button')
  teaserClose.type = 'button'
  teaserClose.setAttribute('aria-label', 'Dismiss message')
  teaserClose.textContent = '\u00d7'
  teaserClose.style.cssText =
    'position:absolute;top:6px;right:6px;width:24px;height:24px;border:none;border-radius:50%;background:transparent;color:#a1a1aa;font-size:18px;line-height:1;cursor:pointer'

  teaser.appendChild(teaserAvatar)
  teaser.appendChild(teaserBody)
  teaser.appendChild(teaserClose)
  document.body.appendChild(teaser)

  applyLayout()

  function showTeaser(data) {
    if (isOpen || typeof data.text !== 'string' || bubble.style.visibility === 'hidden') return
    var name = typeof data.name === 'string' ? data.name : ''
    teaserName.textContent = name
    teaserAvatar.textContent = name ? name.charAt(0).toUpperCase() : ''
    teaserAvatar.style.background = typeof data.color === 'string' ? data.color : brandColor
    teaserText.textContent = data.text
    teaser.setAttribute('aria-label', (name ? name + ': ' : '') + data.text)
    teaser.style.display = 'flex'
    // On the next frame, so the entrance transition runs.
    requestAnimationFrame(function () {
      teaser.style.opacity = '1'
      teaser.style.transform = 'translateY(0)'
    })
    unreadCount = Math.max(unreadCount, 1)
    updateBadge()
  }

  function hideTeaser() {
    teaser.style.display = 'none'
    teaser.style.opacity = '0'
    teaser.style.transform = 'translateY(8px)'
  }

  teaser.addEventListener('click', function () {
    setOpen(true)
  })
  teaser.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  })
  teaserClose.addEventListener('click', function (event) {
    event.stopPropagation()
    hideTeaser()
    unreadCount = 0
    updateBadge()
    postToWidget({ type: 'teaser-dismissed' })
  })

  function postToWidget(payload) {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(Object.assign({ source: MSG_SOURCE_LOADER }, payload), FRONTEND_ORIGIN)
    }
  }

  function setOpen(next) {
    isOpen = next
    iframe.style.opacity = next ? '1' : '0'
    iframe.style.pointerEvents = next ? 'auto' : 'none'
    iframe.style.transform = next ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)'
    renderBubbleIcon()
    bubble.setAttribute('aria-label', next ? 'Close chat' : 'Open chat')
    if (next) {
      unreadCount = 0
      updateBadge()
      hideTeaser()
    }
    postToWidget({ type: 'visibility', open: next })
  }

  bubble.addEventListener('click', function () {
    setOpen(!isOpen)
  })

  // Reports the current page once the widget is ready, then whenever the URL
  // changes. pushState doesn't fire an event, so it's checked on a short timer.
  var widgetReady = false
  var reportedUrl = null

  function reportPage() {
    if (!widgetReady || location.href === reportedUrl) return
    reportedUrl = location.href
    postToWidget({ type: 'page', url: location.href, title: document.title, referrer: document.referrer })
  }

  window.addEventListener('popstate', reportPage)
  window.addEventListener('hashchange', reportPage)
  setInterval(reportPage, 1000)

  // The team can hide the widget by page, device or site. Until the widget has
  // checked, the launcher stays hidden; if it never reports, show it anyway.
  function setDisplayed(visible) {
    bubble.style.visibility = visible ? 'visible' : 'hidden'
    if (!visible) {
      if (isOpen) setOpen(false)
      hideTeaser()
    }
  }
  var displayFallback = setTimeout(function () { setDisplayed(true) }, 4000)

  window.addEventListener('message', function (event) {
    if (event.origin !== FRONTEND_ORIGIN) return
    var data = event.data
    if (!data || data.source !== MSG_SOURCE_WIDGET) return

    if (data.type === 'ready') {
      if (data.color) {
        brandColor = data.color
        bubble.style.background = brandColor
      }
      if (!explicitPosition && (data.position === 'left' || data.position === 'right')) {
        side = data.position
      }
      if (typeof data.width === 'number' && data.width > 0) width = data.width
      if (typeof data.height === 'number' && data.height > 0) height = data.height
      if (typeof data.offsetX === 'number' && data.offsetX >= 0) offsetX = data.offsetX
      if (typeof data.offsetY === 'number' && data.offsetY >= 0) offsetY = data.offsetY
      iconUrl = data.iconUrl || null
      applyLayout()
      widgetReady = true
      reportPage()
    } else if (data.type === 'display') {
      clearTimeout(displayFallback)
      setDisplayed(data.visible !== false)
    } else if (data.type === 'teaser') {
      showTeaser(data)
    } else if (data.type === 'close') {
      setOpen(false)
    } else if (data.type === 'unread') {
      if (!isOpen) {
        unreadCount += 1
        updateBadge()
      }
    }
  })

  window.chatliox = {
    __loaded: true,
    open: function () { setOpen(true) },
    close: function () { setOpen(false) },
    toggle: function () { setOpen(!isOpen) },
  }
})()
