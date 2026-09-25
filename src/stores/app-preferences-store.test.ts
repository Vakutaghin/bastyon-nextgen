import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const store = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: async (key: string) => store.get(key) ?? undefined,
    set: async (key: string, value: unknown) => {
      store.set(key, value)
      return key
    },
  },
}))

import {
  APP_PREFERENCES_KEY,
  DEFAULT_APP_PREFERENCES,
  useAppPreferencesStore,
} from './app-preferences-store'

describe('app-preferences-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store.clear()
  })

  it('без сохранённых значений отдаёт дефолты', async () => {
    const prefs = useAppPreferencesStore()
    await prefs.load()
    expect(prefs.animations).toBe(true)
    expect(prefs.videoAutoplay).toBe(false)
    expect(prefs.commentsOrder).toBe('newest')
    expect(prefs.uiScale).toBe(100)
  })

  it('сохраняет и читает изменённое значение', async () => {
    const prefs = useAppPreferencesStore()
    await prefs.load()
    await prefs.set('animations', false)
    expect(store.get(APP_PREFERENCES_KEY)).toMatchObject({ animations: false })

    setActivePinia(createPinia())
    const again = useAppPreferencesStore()
    await again.load()
    expect(again.animations).toBe(false)
  })

  it('чинит мусор в хранилище до дефолтов', async () => {
    store.set(APP_PREFERENCES_KEY, {
      animations: 'да',
      commentsOrder: 'самые лучшие',
      uiScale: 4242,
      embeddedVideo: false,
    })
    const prefs = useAppPreferencesStore()
    await prefs.load()
    expect(prefs.animations).toBe(DEFAULT_APP_PREFERENCES.animations)
    expect(prefs.commentsOrder).toBe(DEFAULT_APP_PREFERENCES.commentsOrder)
    expect(prefs.uiScale).toBe(DEFAULT_APP_PREFERENCES.uiScale)
    // Валидное значение рядом с мусором сохраняется.
    expect(prefs.embeddedVideo).toBe(false)
  })

  it('принимает только известные масштабы', async () => {
    const prefs = useAppPreferencesStore()
    await prefs.load()
    await prefs.set('uiScale', 125)
    setActivePinia(createPinia())
    const again = useAppPreferencesStore()
    await again.load()
    expect(again.uiScale).toBe(125)
  })

  it('не роняется, если база отдала null', async () => {
    store.set(APP_PREFERENCES_KEY, null)
    const prefs = useAppPreferencesStore()
    await prefs.load()
    expect(prefs.loaded).toBe(true)
    expect(prefs.commentsOrder).toBe('newest')
  })
})
