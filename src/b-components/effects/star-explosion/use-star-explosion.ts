import { onUnmounted, watch, type Ref } from 'vue'
import type { Application, Sprite, Texture } from 'pixi.js'
import { useEffectsStore } from '@/stores/effects-store'
import { initPixiApp, loadPixi } from '@/helpers/common/init-pixi-app'

type Pixi = typeof import('pixi.js')

function resolveContainerEl(
  ref: Ref<HTMLElement | { $el: HTMLElement } | null>
): HTMLElement | null {
  const c = ref.value
  if (!c) return null
  return c instanceof HTMLElement ? c : c.$el
}

export function useStarExplosion(container: Ref<HTMLElement | { $el: HTMLElement } | null>) {
  const effectsStore = useEffectsStore()

  let app: Application | null = null
  let pixi: Pixi | null = null
  /** Запуск PixiJS — один на все взрывы, пока он идёт. */
  let starting: Promise<Application | null> | null = null
  /** Компонент уже снят: запуск, который закончится позже, приложение не оставляет. */
  let disposed = false
  const particles: Array<{
    sprite: Sprite
    vx: number
    vy: number
    life: number
    decay: number
    rotationSpeed: number
  }> = []
  let starTexture: Texture | null = null
  let coinTexture: Texture | null = null

  function createStarTexture(lib: Pixi, appInstance: Application): Texture {
    const graphics = new lib.Graphics()
    graphics.star(0, 0, 5, 10, 5)
    graphics.fill({ color: 0xffd700 })
    graphics.stroke({ width: 1, color: 0xffaa00 })
    return appInstance.renderer.generateTexture(graphics)
  }

  /** Монета: золотой круг с тёмным ободком и внутренним кольцом. */
  function createCoinTexture(lib: Pixi, appInstance: Application): Texture {
    const graphics = new lib.Graphics()
    graphics.circle(0, 0, 9)
    graphics.fill({ color: 0xf5c518 })
    graphics.stroke({ width: 2, color: 0xb8860b })
    graphics.circle(0, 0, 5)
    graphics.stroke({ width: 1, color: 0xe0a800 })
    return appInstance.renderer.generateTexture(graphics)
  }

  function createExplosion(x: number, y: number, variant: 'star' | 'coin' = 'star') {
    const texture = variant === 'coin' ? coinTexture : starTexture
    if (!app || !pixi || !texture) return
    showCanvas(app)

    const particleCount = 20
    for (let i = 0; i < particleCount; i++) {
      const sprite = new pixi.Sprite(texture)
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
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }
    app.ticker.start()
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
    // Частицы кончились — цикл больше не нужен. Отрисовка этого тика (пустая
    // сцена, стирает последний кадр) всё равно пройдёт: она идёт после update.
    if (particles.length === 0 && app) {
      app.ticker.stop()
      app.canvas.style.display = 'none'
    }
  }

  /**
   * Холст показывается только на время взрыва. Прозрачный WebGL-слой во весь
   * экран, висящий постоянно, телефон смешивал с каждым кадром прокрутки.
   * Размер окна мог смениться, пока холст был скрыт, — подгоняем перед показом.
   */
  function showCanvas(instance: Application): void {
    if (instance.canvas.style.display !== 'none') return
    const { innerWidth: w, innerHeight: h } = window
    if (instance.screen.width !== w || instance.screen.height !== h) instance.renderer.resize(w, h)
    instance.canvas.style.display = ''
  }

  /**
   * PixiJS и холст — с первого взрыва, а не при запуске приложения: нужны они
   * только при оценке и донате. Первый взрыв ждёт запуска, дальше — сразу.
   */
  function start(): Promise<Application | null> {
    if (!starting) {
      starting = boot().then((ready) => {
        // Не запустилось (нет контейнера, кусок не загрузился) — попробуем со следующим.
        if (!ready && !disposed) starting = null
        return ready
      })
    }
    return starting
  }

  async function boot(): Promise<Application | null> {
    const el = resolveContainerEl(container)
    if (!el || disposed) return null
    let lib: Pixi
    try {
      lib = await loadPixi()
    } catch {
      return null
    }
    if (disposed) return null

    const instance = new lib.Application()

    // Цикл не крутим постоянно: раньше пустой полноэкранный WebGL-холст
    // перерисовывался 60 раз в секунду всё время работы приложения (N36).
    // Запускается взрывом и сам останавливается, когда частицы догорели.
    // Без WebGL эффекта просто нет — см. initPixiApp.
    const ready = await initPixiApp(
      instance,
      {
        autoStart: false,
        backgroundAlpha: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      },
      '[star-explosion]'
    )
    if (!ready) return null
    const elAfter = resolveContainerEl(container)
    if (disposed || !elAfter) {
      instance.destroy(true, { children: true, texture: true })
      return null
    }
    app = instance
    pixi = lib

    app.canvas.style.position = 'absolute'
    app.canvas.style.top = '0'
    app.canvas.style.left = '0'
    app.canvas.style.pointerEvents = 'none'
    app.canvas.style.display = 'none'
    // Холст касаний не ловит, а система событий PixiJS всё равно слушала
    // каждое движение пальца по документу и крутила свой цикл
    // requestAnimationFrame всё время работы приложения.
    app.renderer.events.setTargetElement(null as unknown as HTMLElement)

    elAfter.appendChild(app.canvas)

    starTexture = createStarTexture(lib, app)
    coinTexture = createCoinTexture(lib, app)

    app.ticker.add(update)
    return app
  }

  onUnmounted(() => {
    disposed = true
    if (app) {
      app.destroy(true, { children: true, texture: true, baseTexture: true })
      app = null
    }
  })

  watch(
    () => effectsStore.explosionEvents,
    (events) => {
      const batch = [...events]
      if (!batch.length) return
      batch.forEach((event) => effectsStore.consumeExplosion(event.id))
      void start().then((ready) => {
        if (!ready) return
        batch.forEach((event) =>
          createExplosion(event.x, event.y, event.variant === 'coin' ? 'coin' : 'star')
        )
      })
    },
    { deep: true }
  )
}
