import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { Application, Graphics, Sprite, Texture } from 'pixi.js'
import { useEffectsStore } from '@/stores/effects-store'

function resolveContainerEl(
  ref: Ref<HTMLElement | { $el: HTMLElement } | null>
): HTMLElement | null {
  const c = ref.value
  if (!c) return null
  return c instanceof HTMLElement ? c : c.$el
}

export function useStarExplosion(
  container: Ref<HTMLElement | { $el: HTMLElement } | null>
) {
  const effectsStore = useEffectsStore()

  let app: Application | null = null
  let particles: Array<{
    sprite: Sprite
    vx: number
    vy: number
    life: number
    decay: number
    rotationSpeed: number
  }> = []
  let starTexture: Texture | null = null

  function createStarTexture(appInstance: Application): Texture {
    const graphics = new Graphics()
    graphics.star(0, 0, 5, 10, 5)
    graphics.fill({ color: 0xffd700 })
    graphics.stroke({ width: 1, color: 0xffaa00 })
    return appInstance.renderer.generateTexture(graphics)
  }

  function createExplosion(x: number, y: number) {
    if (!app || !starTexture) return

    const particleCount = 20
    for (let i = 0; i < particleCount; i++) {
      const sprite = new Sprite(starTexture)
      sprite.x = x
      sprite.y = y
      sprite.anchor.set(0.5)

      const scale = 0.5 + Math.random() * 0.5
      sprite.scale.set(scale)

      app.stage.addChild(sprite)

      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 6

      particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.02,
        rotationSpeed: (Math.random() - 0.5) * 0.2
      })
    }
  }

  function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      if (!p) continue

      p.sprite.x += p.vx
      p.sprite.y += p.vy
      p.vy += 0.15
      p.sprite.rotation += p.rotationSpeed
      p.life -= p.decay
      p.sprite.alpha = p.life

      if (p.life <= 0) {
        if (app) app.stage.removeChild(p.sprite)
        p.sprite.destroy()
        particles.splice(i, 1)
      }
    }
  }

  onMounted(async () => {
    const el = resolveContainerEl(container)
    if (!el) return

    app = new Application()

    await app.init({
      backgroundAlpha: 0,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    app.canvas.style.position = 'absolute'
    app.canvas.style.top = '0'
    app.canvas.style.left = '0'
    app.canvas.style.pointerEvents = 'none'

    el.appendChild(app.canvas)

    starTexture = createStarTexture(app)

    app.ticker.add(update)
  })

  onUnmounted(() => {
    if (app) {
      app.destroy(true, { children: true, texture: true, baseTexture: true })
      app = null
    }
  })

  watch(
    () => effectsStore.explosionEvents,
    (events) => {
      [...events].forEach((event) => {
        createExplosion(event.x, event.y)
        effectsStore.consumeExplosion(event.id)
      })
    },
    { deep: true }
  )
}
