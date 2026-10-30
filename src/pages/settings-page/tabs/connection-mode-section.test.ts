// «Система» → «Подключение к сети»: три режима, выбранный отмечен; под ним —
// чем идут запросы сейчас; с Tor выбор недоступен и это сказано.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({ setMode: vi.fn(), route: vi.fn(async () => 'proxy') }))
vi.mock('@/helpers/api/direct-nodes/connection-route', () => ({
  connectionRoute: h.route,
  setConnectionMode: h.setMode,
}))

import { connectionState } from '@/helpers/api/direct-nodes/connection-state'
import { useTorStore } from '@/stores/tor-store'
import ConnectionModeSection from './connection-mode-section.vue'

let wrapper: VueWrapper | null = null
const status = () => wrapper!.get('[data-testid="connection-status"]').text()
const radio = (label: string) => wrapper!.findAll('[role="radio"]').find((b) => b.text() === label)!

async function mountSection(): Promise<void> {
  wrapper = mount(ConnectionModeSection, { global: { plugins: [i18n] } })
  await flushPromises()
}

describe('ConnectionModeSection', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    h.setMode.mockReset()
    Object.assign(connectionState, {
      mode: 'auto',
      route: 'proxy',
      nodes: 0,
      node: null,
      selecting: false,
      selectFailed: false,
    })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('три режима, «Авто» выбран; сейчас — через прокси', async () => {
    await mountSection()
    expect(wrapper!.findAll('[role="radio"]').map((b) => b.text())).toEqual([
      'Авто',
      'Прокси',
      'Ноды напрямую',
    ])
    expect(radio('Авто').attributes('aria-checked')).toBe('true')
    expect(status()).toBe('Сейчас: через прокси')
    await radio('Ноды напрямую').trigger('click')
    expect(h.setMode).toHaveBeenCalledWith('direct')
  })

  it('прокси молчат — напрямую к нодам; ни одна не ответила — так и сказано', async () => {
    Object.assign(connectionState, { route: 'direct', nodes: 4 })
    await mountSection()
    expect(status()).toContain('Прокси не отвечают, сейчас напрямую к нодам, на связи: 4')

    Object.assign(connectionState, { mode: 'direct' })
    await flushPromises()
    expect(status()).toBe('Сейчас: напрямую к нодам, на связи: 4')

    Object.assign(connectionState, { nodes: 0, selecting: true })
    await flushPromises()
    expect(status()).toBe('Поиск нод…')

    Object.assign(connectionState, { selecting: false, selectFailed: true })
    await flushPromises()
    expect(status()).toContain('Ни одна нода не ответила')
  })

  it('с Tor режим не действует — кнопки недоступны', async () => {
    const tor = useTorStore()
    tor.available = true
    tor.enabled = true
    await mountSection()
    expect(status()).toContain('Включён Tor')
    expect(radio('Прокси').attributes('disabled')).toBeDefined()
  })
})
