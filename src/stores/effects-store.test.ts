import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEffectsStore } from './effects-store'

describe('effects-store', () => {
  let store: ReturnType<typeof useEffectsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useEffectsStore()
  })

  describe('triggerExplosion', () => {
    it('adds explosion event', () => {
      store.triggerExplosion(100, 200)
      expect(store.explosionEvents).toHaveLength(1)
      expect(store.explosionEvents[0].x).toBe(100)
      expect(store.explosionEvents[0].y).toBe(200)
    })

    it('adds explosion with color', () => {
      store.triggerExplosion(50, 50, 0xff0000)
      expect(store.explosionEvents[0].color).toBe(0xff0000)
    })

    it('generates unique ids', () => {
      store.triggerExplosion(0, 0)
      store.triggerExplosion(0, 0)
      expect(store.explosionEvents[0].id).not.toBe(store.explosionEvents[1].id)
    })

    it('limits queue to 10 events', () => {
      for (let i = 0; i < 15; i++) {
        store.triggerExplosion(i, i)
      }
      expect(store.explosionEvents.length).toBeLessThanOrEqual(11)
    })

    it('marks variant as star', () => {
      store.triggerExplosion(1, 2)
      expect(store.explosionEvents[0].variant).toBe('star')
    })
  })

  describe('triggerCoins', () => {
    it('adds a coin-variant event at the given point', () => {
      store.triggerCoins(300, 400)
      expect(store.explosionEvents).toHaveLength(1)
      expect(store.explosionEvents[0].x).toBe(300)
      expect(store.explosionEvents[0].y).toBe(400)
      expect(store.explosionEvents[0].variant).toBe('coin')
    })
  })

  describe('consumeExplosion', () => {
    it('removes explosion by id', () => {
      store.triggerExplosion(100, 200)
      const id = store.explosionEvents[0].id
      store.consumeExplosion(id)
      expect(store.explosionEvents).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      store.triggerExplosion(100, 200)
      store.consumeExplosion(-1)
      expect(store.explosionEvents).toHaveLength(1)
    })
  })
})
