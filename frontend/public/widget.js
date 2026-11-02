/*
 * Chatliox embeddable widget loader.
 *
 * Usage:
 *   <script src="https://your-chatliox-frontend.com/widget.js" data-widget-key="YOUR_WIDGET_KEY" async></script>
 *
 * That's it — launcher position, icon, color, size and offsets are all controlled
 * from the Chatliox dashboard (Settings → Widget), so integrators never need to
 * edit this snippet to match their site.
 *
 * Optional attributes, for when a page needs to override the dashboard setting:
 *   data-position="bottom-right|bottom-left|top-right|top-left" ("left"/"right" mean the bottom corners)
 * Optional pre-load config (set before this script runs):
 *   window.chatlioxSettings = { widgetKey: '...', position: 'bottom-right' }
 *
 * Your own buttons: any element with data-chatliox-open, data-chatliox-close or
 * data-chatliox-toggle opens, closes or toggles the chat, e.g. a "Chat with us"
 * link in a mobile menu. The dashboard can hide the built-in launcher everywhere
 * or only on phones.
 *
 * Styling: everything sits in <div id="chatliox" class="chatliox"> with these parts:
 *   .chatliox-launcher, .chatliox-launcher-icon, .chatliox-badge,
 *   .chatliox-frame, .chatliox-teaser (+ -avatar, -name, -text, -close)
 * and state on the root: [data-open], [data-position], [data-launcher].
 * The default rules have zero specificity, so any CSS you write wins, including
 * the custom CSS set in the dashboard. Sizes and colours are CSS variables:
 *   --chatliox-color, --chatliox-offset-x, --chatliox-offset-y,
 *   --chatliox-width, --chatliox-height, --chatliox-launcher-size
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

  var POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left']
  // The dashboard and older snippets say "left"/"right" for the bottom corners.
  function toPosition(value) {
    if (value === 'left' || value === 'right') return 'bottom-' + value
    return POSITIONS.indexOf(value) === -1 ? null : value
  }

  // A script-tag/settings position is an explicit override that wins over whatever
  // the dashboard has configured; otherwise the org's dashboard setting applies once loaded.
  var explicitPosition = toPosition(CURRENT_SCRIPT.getAttribute('data-position') || settings.position)

  var MSG_SOURCE_WIDGET = 'chatliox-widget'
  var MSG_SOURCE_LOADER = 'chatliox-loader'

  var CHAT_ICON =
    '<svg class="chatliox-launcher-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3 12.75c0 1.6 1.123 2.994 2.707 3.227A48 48 0 0 0 9 16.35V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48 48 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.227V6.741c0-1.602-1.123-2.995-2.707-3.228A48 48 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.009Z" /></svg>'
  var CLOSE_ICON =
    '<svg class="chatliox-launcher-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>'

  // Default look. Every rule is wrapped in :where() so it has zero specificity:
  // the site's own CSS and the team's custom CSS always win without !important.
  var BASE_CSS = [
    ':where(.chatliox){--chatliox-launcher-size:56px;--chatliox-gap:16px;--chatliox-launcher-space:calc(var(--chatliox-launcher-size) + var(--chatliox-gap))}',
    ':where(.chatliox[data-launcher="never"]){--chatliox-launcher-space:0px}',
    '@media (max-width:640px){:where(.chatliox[data-launcher="desktop"]){--chatliox-launcher-space:0px}}',

    ':where(.chatliox-launcher){position:fixed;z-index:2147483001;box-sizing:border-box;width:var(--chatliox-launcher-size);height:var(--chatliox-launcher-size);border:0;border-radius:50%;padding:0;margin:0;background:var(--chatliox-color);color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform 150ms ease}',
    ':where(.chatliox-launcher:hover){transform:scale(1.06)}',
    ':where(.chatliox-launcher img){width:28px;height:28px;border-radius:50%;object-fit:cover;pointer-events:none}',
    ':where(.chatliox[data-displayed="false"] .chatliox-launcher){visibility:hidden}',
    ':where(.chatliox[data-launcher="never"] .chatliox-launcher){display:none}',
    '@media (max-width:640px){:where(.chatliox[data-launcher="desktop"] .chatliox-launcher){display:none}}',

    ':where(.chatliox-badge){position:absolute;top:-2px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#ef4444;color:#fff;font:600 11px/18px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff}',
    ':where(.chatliox-badge[hidden]){display:none}',
    ':where(.chatliox[data-position$="right"] .chatliox-badge){left:-2px}',
    ':where(.chatliox[data-position$="left"] .chatliox-badge){right:-2px}',

    ':where(.chatliox-frame){position:fixed;z-index:2147483000;width:var(--chatliox-width);height:var(--chatliox-height);max-width:calc(100vw - 40px);max-height:calc(100vh - var(--chatliox-offset-y) - var(--chatliox-launcher-space) - 24px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.2);opacity:0;pointer-events:none;transform:translateY(12px) scale(.98);transition:opacity 160ms ease,transform 160ms ease;color-scheme:light}',
    ':where(.chatliox[data-open="true"] .chatliox-frame){opacity:1;pointer-events:auto;transform:none}',

    ':where(.chatliox-teaser){position:fixed;z-index:2147483001;box-sizing:border-box;width:280px;max-width:calc(100vw - 40px);padding:14px 36px 14px 14px;display:none;gap:12px;align-items:flex-start;background:#fff;color:#27272a;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.05);font:14px/1.4 system-ui,-apple-system,sans-serif;cursor:pointer;text-align:left}',
    ':where(.chatliox[data-teaser="true"] .chatliox-teaser){display:flex;animation:chatliox-in 220ms ease}',
    ':where(.chatliox-teaser-avatar){flex:none;width:32px;height:32px;border-radius:50%;background:var(--chatliox-color);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px}',
    ':where(.chatliox-teaser-body){min-width:0;display:flex;flex-direction:column;gap:2px}',
    ':where(.chatliox-teaser-name){font-size:11px;color:#a1a1aa}',
    ':where(.chatliox-teaser-text){white-space:pre-wrap;overflow-wrap:anywhere}',
    ':where(.chatliox-teaser-close){position:absolute;top:6px;right:6px;width:24px;height:24px;border:0;border-radius:50%;background:transparent;color:#a1a1aa;font-size:18px;line-height:1;cursor:pointer;padding:0}',
    '@keyframes chatliox-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){:where(.chatliox-frame,.chatliox-launcher){transition:none}:where(.chatliox[data-teaser="true"] .chatliox-teaser){animation:none}}',

    // Corners. The frame and teaser sit beyond the launcher, or in its place when it's hidden.
    ':where(.chatliox[data-position$="right"]) :where(.chatliox-launcher,.chatliox-frame,.chatliox-teaser){right:var(--chatliox-offset-x)}',
    ':where(.chatliox[data-position$="left"]) :where(.chatliox-launcher,.chatliox-frame,.chatliox-teaser){left:var(--chatliox-offset-x)}',
    ':where(.chatliox[data-position^="bottom"] .chatliox-launcher){bottom:var(--chatliox-offset-y)}',
    ':where(.chatliox[data-position^="top"] .chatliox-launcher){top:var(--chatliox-offset-y)}',
    ':where(.chatliox[data-position^="bottom"]) :where(.chatliox-frame,.chatliox-teaser){bottom:calc(var(--chatliox-offset-y) + var(--chatliox-launcher-space))}',
    ':where(.chatliox[data-position^="top"]) :where(.chatliox-frame,.chatliox-teaser){top:calc(var(--chatliox-offset-y) + var(--chatliox-launcher-space))}',
    ':where(.chatliox[data-position="bottom-right"] .chatliox-frame){transform-origin:bottom right}',
    ':where(.chatliox[data-position="bottom-left"] .chatliox-frame){transform-origin:bottom left}',
    ':where(.chatliox[data-position="top-right"] .chatliox-frame){transform-origin:top right}',
    ':where(.chatliox[data-position="top-left"] .chatliox-frame){transform-origin:top left}',
  ].join('\n')

  function addStyle(id, css) {
    var style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
    return style
  }

  // In order: the defaults, the dashboard's settings as variables, then the team's
  // custom CSS, so each can override the one before.
  addStyle('chatliox-base', BASE_CSS)
  var configStyle = addStyle('chatliox-config', '')
  var customStyle = addStyle('chatliox-custom', '')

  var isOpen = false
  var unreadCount = 0

  // Layout defaults — reconciled with the org's dashboard settings once the widget
  // iframe reports in via the 'ready' message. Kept here so the launcher renders
  // instantly instead of waiting on the iframe to load.
  var config = {
    color: '#4f6ef7',
    position: explicitPosition || 'bottom-right',
    width: 376,
    height: 600,
    offsetX: 20,
    offsetY: 20,
    iconUrl: null,
    launcher: 'always',
  }

  var root = document.createElement('div')
  root.id = 'chatliox'
  root.className = 'chatliox'
  // Shown once the widget confirms the team's display rules allow this page.
  root.setAttribute('data-displayed', 'false')
  root.setAttribute('data-open', 'false')
  root.setAttribute('data-teaser', 'false')

  var iframe = document.createElement('iframe')
  iframe.className = 'chatliox-frame'
  iframe.src = FRONTEND_ORIGIN + '/widget?key=' + encodeURIComponent(widgetKey) + '&embed=1'
  iframe.title = 'Chat widget'
  iframe.setAttribute('allow', 'clipboard-write')

  var launcher = document.createElement('button')
  launcher.type = 'button'
  launcher.className = 'chatliox-launcher'
  launcher.setAttribute('aria-label', 'Open chat')

  var badge = document.createElement('span')
  badge.className = 'chatliox-badge'
  badge.hidden = true

  // A proactive message from the team, shown beside the launcher while the chat
  // is closed. Clicking it opens the chat; the × dismisses it.
  var teaser = document.createElement('div')
  teaser.className = 'chatliox-teaser'
  teaser.setAttribute('role', 'button')
  teaser.setAttribute('tabindex', '0')
  var teaserAvatar = document.createElement('span')
  teaserAvatar.className = 'chatliox-teaser-avatar'
  var teaserBody = document.createElement('span')
  teaserBody.className = 'chatliox-teaser-body'
  var teaserName = document.createElement('span')
  teaserName.className = 'chatliox-teaser-name'
  var teaserText = document.createElement('span')
  teaserText.className = 'chatliox-teaser-text'
  var teaserClose = document.createElement('button')
  teaserClose.type = 'button'
  teaserClose.className = 'chatliox-teaser-close'
  teaserClose.setAttribute('aria-label', 'Dismiss message')
  teaserClose.textContent = '×'
  teaserBody.appendChild(teaserName)
  teaserBody.appendChild(teaserText)
  teaser.appendChild(teaserAvatar)
  teaser.appendChild(teaserBody)
  teaser.appendChild(teaserClose)

  root.appendChild(iframe)
  root.appendChild(teaser)
  root.appendChild(launcher)
  document.body.appendChild(root)

  function updateBadge() {
    badge.hidden = unreadCount === 0
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
  }

  // Renders the launcher's icon: the close glyph while open, the org's custom
  // icon image when set, otherwise the built-in chat glyph. Uses DOM APIs rather
  // than string-built HTML for the custom icon since iconUrl is untrusted input.
  function renderLauncherIcon() {
    while (launcher.firstChild) launcher.removeChild(launcher.firstChild)
    if (isOpen) {
      launcher.innerHTML = CLOSE_ICON
    } else if (config.iconUrl) {
      var img = document.createElement('img')
      img.className = 'chatliox-launcher-icon'
      img.alt = ''
      img.onerror = function () {
        config.iconUrl = null
        renderLauncherIcon()
      }
      img.src = config.iconUrl
      launcher.appendChild(img)
    } else {
      launcher.innerHTML = CHAT_ICON
    }
    launcher.appendChild(badge)
  }

  // Re-applies the dashboard's settings. Called on init and again whenever the
  // widget iframe reports the org's configuration.
  function applyConfig() {
    root.setAttribute('data-position', config.position)
    root.setAttribute('data-launcher', config.launcher)
    configStyle.textContent =
      ':where(.chatliox){' +
      '--chatliox-color:' + config.color + ';' +
      '--chatliox-width:' + config.width + 'px;' +
      '--chatliox-height:' + config.height + 'px;' +
      '--chatliox-offset-x:' + config.offsetX + 'px;' +
      '--chatliox-offset-y:' + config.offsetY + 'px}'
    renderLauncherIcon()
  }

  applyConfig()

  function showTeaser(data) {
    if (isOpen || typeof data.text !== 'string' || root.getAttribute('data-displayed') === 'false') return
    var name = typeof data.name === 'string' ? data.name : ''
    teaserName.textContent = name
    teaserAvatar.textContent = name ? name.charAt(0).toUpperCase() : ''
    teaserText.textContent = data.text
    teaser.setAttribute('aria-label', (name ? name + ': ' : '') + data.text)
    root.setAttribute('data-teaser', 'true')
    unreadCount = Math.max(unreadCount, 1)
    updateBadge()
  }

  function hideTeaser() {
    root.setAttribute('data-teaser', 'false')
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
    root.setAttribute('data-open', next ? 'true' : 'false')
    renderLauncherIcon()
    launcher.setAttribute('aria-label', next ? 'Close chat' : 'Open chat')
    launcher.setAttribute('aria-expanded', next ? 'true' : 'false')
    if (next) {
      unreadCount = 0
      updateBadge()
      hideTeaser()
    }
    postToWidget({ type: 'visibility', open: next })
  }

  launcher.addEventListener('click', function () {
    setOpen(!isOpen)
  })

  // The site's own buttons: anything marked data-chatliox-open/close/toggle.
  document.addEventListener('click', function (event) {
    var target = event.target
    if (!target || !target.closest) return
    var trigger = target.closest('[data-chatliox-open],[data-chatliox-close],[data-chatliox-toggle]')
    if (!trigger) return
    event.preventDefault()
    if (trigger.hasAttribute('data-chatliox-open')) setOpen(true)
    else if (trigger.hasAttribute('data-chatliox-close')) setOpen(false)
    else setOpen(!isOpen)
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
    root.setAttribute('data-displayed', visible ? 'true' : 'false')
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
      if (typeof data.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.color)) config.color = data.color
      if (!explicitPosition) config.position = toPosition(data.position) || config.position
      if (data.launcher === 'always' || data.launcher === 'desktop' || data.launcher === 'never') config.launcher = data.launcher
      if (typeof data.width === 'number' && data.width > 0) config.width = data.width
      if (typeof data.height === 'number' && data.height > 0) config.height = data.height
      if (typeof data.offsetX === 'number' && data.offsetX >= 0) config.offsetX = data.offsetX
      if (typeof data.offsetY === 'number' && data.offsetY >= 0) config.offsetY = data.offsetY
      config.iconUrl = data.iconUrl || null
      // Set as text, so it can only ever be CSS.
      customStyle.textContent = typeof data.customCss === 'string' ? data.customCss : ''
      applyConfig()
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
