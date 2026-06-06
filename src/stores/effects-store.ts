import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEffectsStore = defineStore('effects', () => {
  // Event-based architecture for effects
  // Components subscribe to this store to trigger visual effects

  // We use a simple counter/timestamp to trigger reactivity if needed,
  // but mostly we'll expose methods that the Effects component can listen to.
  // Actually, since Pinia is state-based, we can store a queue of "effect events".

  /** Вид частиц: золотая звезда (рейтинги) или монета (донат). */
  type ExplosionVariant = 'star' | 'coin'

  interface ExplosionEvent {
    id: number
    x: number
    y: number
    color?: number
    variant?: ExplosionVariant
  }

  const explosionEvents = ref<ExplosionEvent[]>([])

  const pushEvent = (x: number, y: number, color?: number, variant?: ExplosionVariant) => {
    explosionEvents.value.push({
      id: Date.now() + Math.random(),
      x,
      y,
      color,
      variant,
    })

    // Cleanup old events after a short delay to keep memory low
    // The consumer (StarExplosion component) should process them immediately
    if (explosionEvents.value.length > 10) {
      explosionEvents.value.shift()
    }
  }

  const triggerExplosion = (x: number, y: number, color?: number) => {
    pushEvent(x, y, color, 'star')
  }

  /** Всплеск монеток (донат). */
  const triggerCoins = (x: number, y: number) => {
    pushEvent(x, y, undefined, 'coin')
  }

  const consumeExplosion = (id: number) => {
    const index = explosionEvents.value.findIndex((e) => e.id === id)
    if (index !== -1) {
      explosionEvents.value.splice(index, 1)
    }
  }

  return {
    explosionEvents,
    triggerExplosion,
    triggerCoins,
    consumeExplosion,
  }
})
