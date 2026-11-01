// «Где хранить»: на компьютере — «Выбрать папку…» (системный выбор папки) и
// «Стандартная папка», на Android — «Память телефона» / «Карта памяти» (карта —
// если вставлена); ход переноса и понятная причина, если не вышло.

import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({
  platform: 'web',
  picked: null as string | null,
  store: null as unknown as Record<string, unknown>,
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => h.platform } }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => h.picked) }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('@/stores/offline-videos-store', () => ({ useOfflineVideosStore: () => h.store }))

import OfflineLocationRow from './offline-location-row.vue'

function makeStore(location: Record<string, unknown>) {
  h.store = reactive({
    canChooseLocation: true,
    location,
    moving: null as { done: number; total: number } | null,
    hydrate: vi.fn(async () => {}),
    refreshLocation: vi.fn(async () => {}),
    moveTo: vi.fn(async () => {}),
  })
  return h.store as { moveTo: ReturnType<typeof vi.fn>; moving: unknown }
}

const mountRow = () =>
  mount(OfflineLocationRow, { global: { plugins: [i18n], provide: { theme: {} } } })

describe('OfflineLocationRow', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    h.platform = 'web'
    h.picked = null
    h.toast.success.mockReset()
    h.toast.error.mockReset()
  })

  it('компьютер: путь, «Выбрать папку…» переносит в выбранную; отмена выбора — ничего', async () => {
    const store = makeStore({ path: '/app/offline', isDefault: true, unavailable: null, free: 1 })
    const wrapper = mountRow()
    await flushPromises()
    expect(wrapper.text()).toContain('/app/offline')
    expect(wrapper.find('[data-testid="offline-location-default"]').exists()).toBe(false)

    await wrapper.find('[data-testid="offline-location-choose"]').trigger('click')
    await flushPromises()
    expect(store.moveTo).not.toHaveBeenCalled()

    h.picked = '/Volumes/Disk'
    await wrapper.find('[data-testid="offline-location-choose"]').trigger('click')
    await flushPromises()
    expect(store.moveTo).toHaveBeenCalledWith('/Volumes/Disk')
    expect(h.toast.success).toHaveBeenCalledWith({ message: 'Скачанное перенесено' })
  })

  it('диск не подключён — предупреждение и «Стандартная папка»; ошибка переноса — словами', async () => {
    const store = makeStore({
      path: '/app/offline',
      isDefault: true,
      unavailable: '/Volumes/Gone/Bastyon offline',
      free: 1,
    })
    store.moveTo.mockRejectedValue(new Error('no_space'))
    const wrapper = mountRow()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('/Volumes/Gone/Bastyon offline')
    await wrapper.find('[data-testid="offline-location-default"]').trigger('click')
    await flushPromises()
    expect(store.moveTo).toHaveBeenCalledWith(null)
    expect(h.toast.error).toHaveBeenCalledWith({ message: 'На новом месте не хватит места' })
  })

  it('Android: карта — только если вставлена; идёт перенос — ход и кнопки не нажимаются', async () => {
    h.platform = 'android'
    const store = makeStore({
      current: 'internal',
      isDefault: true,
      unavailable: null,
      free: 1,
      sd: null,
    })
    const wrapper = mountRow()
    await flushPromises()
    expect(wrapper.find('[data-testid="offline-location-sd"]').exists()).toBe(false)
    // Уже в памяти телефона — переносить некуда.
    await wrapper.find('[data-testid="offline-location-internal"]').trigger('click')
    expect(store.moveTo).not.toHaveBeenCalled()
    ;(h.store.location as Record<string, unknown>).sd = { free: 5 }
    await flushPromises()
    await wrapper.find('[data-testid="offline-location-sd"]').trigger('click')
    await flushPromises()
    expect(store.moveTo).toHaveBeenCalledWith('sd')

    store.moving = { done: 2, total: 5 }
    await flushPromises()
    expect(wrapper.text()).toContain('Переносим: 2 из 5')
    expect(wrapper.find('[data-testid="offline-location-sd"]').attributes('disabled')).toBeDefined()
  })
})
