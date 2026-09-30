// Номер версии с кнопкой проверки обновлений (левая панель и меню телефона):
// что написано до, во время и после проверки и когда подпись возвращается.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

const h = vi.hoisted(() => ({
  state: null as unknown as {
    available: import('vue').Ref<{ tag: string; version: string } | null>
    hasUpdate: import('vue').Ref<boolean>
    checking: import('vue').Ref<boolean>
    failed: import('vue').Ref<boolean>
  },
  check: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))
vi.mock('@/composables/use-app-update', () => ({
  useAppUpdate: () => ({ ...h.state, currentVersion: '0.9.1', check: h.check }),
}))

import AppVersionBadge from './app-version-badge.vue'

function badge(compact = false) {
  return mount(AppVersionBadge, { props: { compact } })
}

beforeEach(() => {
  h.state = {
    available: ref(null),
    hasUpdate: ref(false),
    checking: ref(false),
    failed: ref(false),
  }
  h.check.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AppVersionBadge', () => {
  it('показывает номер версии, кнопка — «проверить обновления»', () => {
    const b = badge()
    expect(b.text()).toBe('v0.9.1')
    expect(b.get('button').attributes('aria-label')).toBe('update.checkUpdates')
  })

  it('проверка идёт с ручным запросом, кнопка на это время выключена', async () => {
    let finish: (v: null) => void = () => {}
    h.check.mockImplementation(() => {
      h.state.checking.value = true
      return new Promise((resolve) => {
        finish = (v) => {
          h.state.checking.value = false
          resolve(v)
        }
      })
    })
    const b = badge()
    await b.get('button').trigger('click')
    expect(h.check).toHaveBeenCalledWith({ offerSkipped: true })
    expect(b.text()).toBe('update.checking')
    expect(b.get('button').attributes('disabled')).toBeDefined()
    expect(b.find('.ui-icon-spin').exists()).toBe(true)
    finish(null)
    await flushPromises()
  })

  it('обновлений нет — «последняя версия» на несколько секунд, потом снова номер', async () => {
    vi.useFakeTimers()
    h.check.mockResolvedValue(null)
    const b = badge()
    await b.get('button').trigger('click')
    await flushPromises()
    expect(b.text()).toBe('update.upToDate')
    expect(b.get('span').classes()).toContain('success')

    await vi.advanceTimersByTimeAsync(5000)
    expect(b.text()).toBe('v0.9.1')
  })

  it('проверка не удалась — так и сказано', async () => {
    h.check.mockImplementation(async () => {
      h.state.failed.value = true
      return null
    })
    const b = badge()
    await b.get('button').trigger('click')
    await flushPromises()
    expect(b.text()).toBe('update.failed')
    expect(b.get('span').classes()).toContain('warning')
  })

  it('найдена новая версия — видно у номера, пока её не пропустят', async () => {
    h.state.available.value = { tag: 'v0.9.2', version: '0.9.2' }
    h.state.hasUpdate.value = true
    const b = badge()
    expect(b.text()).toBe('update.newVersion:{"version":"v0.9.2"}')
    expect(b.get('span').classes()).toContain('accent')

    h.state.hasUpdate.value = false
    await flushPromises()
    expect(b.text()).toBe('v0.9.1')
  })

  it('в свёрнутой панели подписи нет, номер версии — в подсказке кнопки', () => {
    const b = badge(true)
    expect(b.text()).toBe('')
    expect(b.get('button').attributes('title')).toBe('v0.9.1 · update.checkUpdates')
  })
})
