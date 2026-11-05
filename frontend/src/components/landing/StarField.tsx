import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** 0 = far away, 1 = close. Close stars are bigger, faster and follow the mouse more. */
  depth: number
  phase: number
  speed: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

const LINK_DISTANCE = 110
const MOUSE_SHIFT = 26

/**
 * Drifting, twinkling stars with faint lines between near neighbours, a gentle
 * parallax toward the mouse and the odd shooting star. Fills its positioned
 * parent. Pauses off-screen and in background tabs, and draws a single still
 * frame when the visitor prefers reduced motion.
 */
export default function StarField({ density = 1, className = '' }: { density?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = getComputedStyle(document.documentElement).getPropertyValue('--zinc-800').trim() || '221 221 221'
    let stars: Star[] = []
    let meteors: Meteor[] = []
    let width = 0
    let height = 0
    let frame = 0
    let visible = true
    let last = performance.now()
    let nextMeteor = 1500 + Math.random() * 2500
    // Mouse position relative to the canvas centre, -1..1, eased toward its target.
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

    const seed = () => {
      const count = Math.round(((width * height) / 11000) * density)
      stars = Array.from({ length: count }, () => {
        const depth = Math.random()
        const angle = Math.random() * Math.PI * 2
        const speed = 0.006 + depth * 0.02 // 6–26 px per second
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.004, // a slight shared upward drift
          r: 0.4 + depth * 1.1,
          depth,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0015 + Math.random() * 0.0025,
        }
      })
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      draw(0)
    }

    const spawnMeteor = () => {
      const fromLeft = Math.random() < 0.5
      const speed = 0.55 + Math.random() * 0.35
      const angle = (fromLeft ? 1 : -1) * (0.28 + Math.random() * 0.2)
      meteors.push({
        x: fromLeft ? Math.random() * width * 0.5 : width * 0.5 + Math.random() * width * 0.5,
        y: Math.random() * height * 0.35,
        vx: Math.sin(angle) * speed * (fromLeft ? 1 : 1),
        vy: Math.cos(angle) * speed * 0.55,
        life: 1,
      })
    }

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height)
      mouse.x += (mouse.tx - mouse.x) * Math.min(dt * 0.004, 1)
      mouse.y += (mouse.ty - mouse.y) * Math.min(dt * 0.004, 1)

      for (const s of stars) {
        s.x += s.vx * dt
        s.y += s.vy * dt
        if (s.x < -20) s.x = width + 20
        if (s.x > width + 20) s.x = -20
        if (s.y < -20) s.y = height + 20
        if (s.y > height + 20) s.y = -20
        s.phase += s.speed * dt
      }
      const px = (s: Star) => s.x + mouse.x * MOUSE_SHIFT * s.depth
      const py = (s: Star) => s.y + mouse.y * MOUSE_SHIFT * s.depth

      // Faint lines between close stars, fading with distance.
      ctx.lineWidth = 0.6
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i]
        const ax = px(a)
        const ay = py(a)
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j]
          const dx = ax - px(b)
          const dy = ay - py(b)
          const d2 = dx * dx + dy * dy
          if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue
          const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.09
          ctx.strokeStyle = `rgb(${color} / ${alpha})`
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(px(b), py(b))
          ctx.stroke()
        }
      }

      for (const s of stars) {
        const wave = 0.5 + 0.5 * Math.sin(s.phase)
        const twinkle = 0.12 + 0.88 * wave * wave
        const x = px(s)
        const y = py(s)
        ctx.fillStyle = `rgb(${color} / ${twinkle})`
        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, Math.PI * 2)
        ctx.fill()
        // Brightest moments of the bigger stars get a soft halo.
        if (s.depth > 0.7 && wave > 0.85) {
          ctx.fillStyle = `rgb(${color} / ${(wave - 0.85) * 0.9})`
          ctx.beginPath()
          ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Shooting stars: a fading streak every few seconds.
      if (dt > 0) {
        nextMeteor -= dt
        if (nextMeteor <= 0) {
          spawnMeteor()
          nextMeteor = 3500 + Math.random() * 4500
        }
      }
      meteors = meteors.filter((m) => m.life > 0)
      for (const m of meteors) {
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.life -= dt / 1100
        const tail = 90
        const len = Math.hypot(m.vx, m.vy)
        const tx = m.x - (m.vx / len) * tail
        const ty = m.y - (m.vy / len) * tail
        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty)
        grad.addColorStop(0, `rgb(${color} / ${0.85 * Math.max(m.life, 0)})`)
        grad.addColorStop(1, `rgb(${color} / 0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(tx, ty)
        ctx.stroke()
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64)
      last = now
      draw(dt)
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (reduceMotion || frame || !visible || document.hidden) return
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const onMouse = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouse.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(canvas)
    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pointermove', onMouse, { passive: true })
    start()

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onMouse)
    }
  }, [density])

  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />
}
