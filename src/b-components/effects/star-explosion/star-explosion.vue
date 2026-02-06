<template>
  <div ref="container" class="star-explosion-container"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Application, Graphics, Sprite, Texture, Container } from 'pixi.js'
import { useEffectsStore } from '@/stores/effects-store'

const container = ref<HTMLElement | null>(null)
const effectsStore = useEffectsStore()

// Pixi variables
let app: Application | null = null
let particles: any[] = []
let starTexture: Texture | null = null

// Initialize Pixi
onMounted(async () => {
  if (!container.value) return

  app = new Application()
  
  // Pixi v8 uses init(), v7 uses constructor options. 
  // We'll try to support the installed version.
  // Assuming v8 based on "npm install pixi.js" pulling latest.
  await app.init({
    backgroundAlpha: 0,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  })

  // Set canvas style
  app.canvas.style.position = 'absolute'
  app.canvas.style.top = '0'
  app.canvas.style.left = '0'
  app.canvas.style.pointerEvents = 'none'

  container.value.appendChild(app.canvas)

  // Generate star texture
  starTexture = createStarTexture(app)

  // Start ticker
  app.ticker.add(update)
})

onUnmounted(() => {
  if (app) {
    app.destroy(true, { children: true, texture: true, baseTexture: true })
    app = null
  }
})

// Watch for explosion events
watch(() => effectsStore.explosionEvents, (events) => {
  // Process new events
  // Since we might get multiple events, we process all that haven't been handled
  // But the store keeps them. We'll just take the last one added? 
  // Better: The store appends. We can just iterate and consume.
  
  // Optimization: Just process the array and clear it via store action
  // But watching an array deeply can be tricky if we modify it inside the watcher loop via another store action.
  // We'll just copy the events to process and then ask store to remove them.
  
  // Actually, simplest way: Just iterate backwards.
  // Or better: Use subscription pattern if Store allows, but `watch` is fine.
  
  // We'll iterate a copy to avoid modification issues during iteration
  [...events].forEach(event => {
    createExplosion(event.x, event.y)
    effectsStore.consumeExplosion(event.id)
  })
}, { deep: true })

function createStarTexture(app: Application): Texture {
  const graphics = new Graphics()
  graphics.star(0, 0, 5, 10, 5) // x, y, points, outerRadius, innerRadius
  graphics.fill({ color: 0xffd700 }) // Gold
  graphics.stroke({ width: 1, color: 0xffaa00 })
  
  // In Pixi v8, generating texture from graphics might be async or require app.renderer
  // app.renderer.generateTexture(graphics) is common in v7
  // In v8: app.renderer.generateTexture(graphics)
  
  return app.renderer.generateTexture(graphics)
}

function createExplosion(x: number, y: number) {
  if (!app || !starTexture) return

  const particleCount = 20
  for (let i = 0; i < particleCount; i++) {
    const sprite = new Sprite(starTexture)
    sprite.x = x
    sprite.y = y
    sprite.anchor.set(0.5)
    
    // Random scale
    const scale = 0.5 + Math.random() * 0.5
    sprite.scale.set(scale)
    
    // Random tint (gold variations)
    // sprite.tint = 0xFFD700
    
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
    
    p.sprite.x += p.vx
    p.sprite.y += p.vy
    p.vy += 0.15 // Gravity
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
</script>

<style scoped>
.star-explosion-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
</style>
