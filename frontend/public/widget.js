/*
 * Chatliox embeddable widget loader.
 *
 * Usage:
 *   <script src="https://your-chatliox-frontend.com/widget.js" data-widget-key="YOUR_WIDGET_KEY" async></script>
 *
 * Optional attributes: data-position="left|right" (default "right").
 * Optional pre-load config (set before this script runs):
 *   window.chatlioxSettings = { widgetKey: '...', position: 'right' }
 *
 * Exposes window.chatliox = { open(), close(), toggle() } for programmatic control.
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
  var side = (CURRENT_SCRIPT.getAttribute('data-position') || settings.position) === 'left' ? 'left' : 'right'

  var MSG_SOURCE_WIDGET = 'chatliox-widget'
  var MSG_SOURCE_LOADER = 'chatliox-loader'

  var CHAT_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3 12.75c0 1.6 1.123 2.994 2.707 3.227A48 48 0 0 0 9 16.35V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48 48 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.227V6.741c0-1.602-1.123-2.995-2.707-3.228A48 48 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.009Z" /></svg>'
  var CLOSE_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>'

  var isOpen = false
  var unreadCount = 0
  var brandColor = '#4f6ef7'

  var iframe = document.createElement('iframe')
  iframe.src = FRONTEND_ORIGIN + '/widget?key=' + encodeURIComponent(widgetKey) + '&embed=1'
  iframe.title = 'Chat widget'
  iframe.setAttribute('allow', 'clipboard-write')
  iframe.style.cssText = [
    'position:fixed',
    'bottom:92px',
    side + ':20px',
    'width:376px',
    'height:600px',
    'max-height:calc(100vh - 120px)',
    'max-width:calc(100vw - 40px)',
    'border:none',
    'border-radius:16px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.2)',
    'z-index:2147483000',
    'opacity:0',
    'pointer-events:none',
    'transform:translateY(12px) scale(0.98)',
    'transform-origin:bottom ' + side,
    'transition:opacity 160ms ease,transform 160ms ease',
    'color-scheme:light',
  ].join(';')
  document.body.appendChild(iframe)

  var bubble = document.createElement('button')
  bubble.type = 'button'
  bubble.setAttribute('aria-label', 'Open chat')
  bubble.style.cssText = [
    'position:fixed',
    'bottom:20px',
    side + ':20px',
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
  ].join(';')
  bubble.innerHTML = CHAT_ICON
  bubble.addEventListener('mouseenter', function () { bubble.style.transform = 'scale(1.06)' })
  bubble.addEventListener('mouseleave', function () { bubble.style.transform = 'scale(1)' })
  document.body.appendChild(bubble)

  var badge = document.createElement('span')
  badge.style.cssText = [
    'position:absolute',
    'top:-2px',
    (side === 'left' ? 'right' : 'left') + ':-2px',
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
  bubble.appendChild(badge)

  function updateBadge() {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
      badge.style.display = 'block'
    } else {
      badge.style.display = 'none'
    }
  }

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
    bubble.innerHTML = next ? CLOSE_ICON : CHAT_ICON
    bubble.appendChild(badge)
    bubble.setAttribute('aria-label', next ? 'Close chat' : 'Open chat')
    if (next) {
      unreadCount = 0
      updateBadge()
    }
    postToWidget({ type: 'visibility', open: next })
  }

  bubble.addEventListener('click', function () {
    setOpen(!isOpen)
  })

  window.addEventListener('message', function (event) {
    if (event.origin !== FRONTEND_ORIGIN) return
    var data = event.data
    if (!data || data.source !== MSG_SOURCE_WIDGET) return

    if (data.type === 'ready') {
      if (data.color) {
        brandColor = data.color
        bubble.style.background = brandColor
      }
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
