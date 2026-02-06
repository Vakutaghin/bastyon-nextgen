import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEffectsStore = defineStore('effects', () => {
  // Event-based architecture for effects
  // Components subscribe to this store to trigger visual effects

  // We use a simple counter/timestamp to trigger reactivity if needed,
  // but mostly we'll expose methods that the Effects component can listen to.
  // Actually, since Pinia is state-based, we can store a queue of "effect events".

  interface ExplosionEvent {
    id: number
    x: number
    y: number
    color?: number
  }

  const explosionEvents = ref<ExplosionEvent[]>([])

  const triggerExplosion = (x: number, y: number, color?: number) => {
    explosionEvents.value.push({
      id: Date.now() + Math.random(),
      x,
      y,
      color
    })

    // Cleanup old events after a short delay to keep memory low
    // The consumer (StarExplosion component) should process them immediately
    if (explosionEvents.value.length > 10) {
      explosionEvents.value.shift()
    }
  }

  const consumeExplosion = (id: number) => {
    const index = explosionEvents.value.findIndex(e => e.id === id)
    if (index !== -1) {
      explosionEvents.value.splice(index, 1)
    }
  }

  return {
    explosionEvents,
    triggerExplosion,
    consumeExplosion
  }
})
