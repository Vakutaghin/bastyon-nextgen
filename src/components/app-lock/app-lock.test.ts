// Ввод кода замка: клавиатура пин-кода откликается на касание и на цифры с
// клавиатуры, ключ рисуется по точкам с серединой прямой, экран замка
// закрывает собой приложение (inert), неверный код — сообщение и сброс,
// верный — экран уходит; «Забыли?» ведёт к вводу фразы.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ signOut: vi.fn(async () => {}) }),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }))

import { i18n, setI18nLocale } from '@/i18n'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import {
  configureVault,
  ensureInitialized,
  __resetVaultForTests,
} from '@/blockchain/storage/vault/crypto-vault'
import { createMemoryVaultKeyStore } from '@/blockchain/storage/vault/vault-key-store'
import { useAppLockStore } from '@/stores/app-lock-store'
import PinPad from './pin-pad.vue'
import PatternGrid from './pattern-grid.vue'
import AppLockScreen from './app-lock-screen.vue'

const mounted: VueWrapper[] = []
const keep = (w: VueWrapper): VueWrapper => (mounted.push(w), w)
const global = { plugins: [i18n], provide: { theme: {} } }

function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, ...init })
}

/** Нажать клавиши пин-кода касанием (по подписи). */
function tap(root: ParentNode, keys: string): void {
  const buttons = Array.from(root.querySelectorAll('button'))
  for (const key of keys) {
    const button = buttons.find((b) => b.textContent?.trim() === key)!
    button.dispatchEvent(pointer('pointerdown'))
    button.dispatchEvent(pointer('pointerup'))
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
  __resetVaultForTests()
  configureVault({ keyStore: createMemoryVaultKeyStore() })
  setActivePinia(createPinia())
  setI18nLocale('ru')
})

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PinPad', () => {
  it('цифры — по касанию; набрали все — complete; «Стереть» убирает последнюю', async () => {
    const w = keep(mount(PinPad, { props: { length: 4 }, global, attachTo: document.body }))
    tap(w.element, '25')
    await nextTick()
    expect(w.findAll('.filled')).toHaveLength(2)
    w.find('button[aria-label="Стереть"]').element.dispatchEvent(pointer('pointerdown'))
    tap(w.element, '480')
    expect(w.emitted('complete')).toEqual([['2480']])
  })

  it('с клавиатуры компьютера — только когда разрешено; набранный код ждёт проверки', async () => {
    const w = keep(mount(PinPad, { props: { length: 4 }, global, attachTo: document.body }))
    for (const key of '1234') window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    expect(w.emitted('complete')).toBeUndefined()

    await w.setProps({ keyboard: true })
    for (const key of '1235') window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' }))
    expect(w.emitted('complete')).toEqual([['1235']])
  })

  it('fail(): точки краснеют и гаснут, ввод начинается заново', async () => {
    vi.useFakeTimers()
    const w = keep(mount(PinPad, { props: { length: 4 }, global, attachTo: document.body }))
    tap(w.element, '1111')
    ;(w.vm as unknown as { fail: () => void }).fail()
    await nextTick()
    expect(w.findAll('.error')).toHaveLength(4)
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(w.findAll('.filled')).toHaveLength(0)
    expect(w.findAll('.error')).toHaveLength(0)
  })

  it('в паузе после ошибок клавиши не нажимаются', () => {
    const w = keep(
      mount(PinPad, { props: { length: 4, disabled: true }, global, attachTo: document.body })
    )
    tap(w.element, '1234')
    expect(w.emitted('complete')).toBeUndefined()
  })
})

describe('PatternGrid', () => {
  const rect = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0 }

  it('росчерк 0→2→8 даёт 0,1,2,5,8 — середины добавляются сами', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rect as unknown as ReturnType<HTMLElement['getBoundingClientRect']>
    )
    const w = keep(mount(PatternGrid, { global, attachTo: document.body }))
    const grid = w.element as HTMLElement
    grid.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 50 }))
    grid.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 50 }))
    grid.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 250 }))
    expect(grid.querySelectorAll('.on')).toHaveLength(5)
    grid.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 250 }))
    expect(w.emitted('complete')).toEqual([[[0, 1, 2, 5, 8]]])
  })

  it('отменённый жест (система забрала палец) — без complete, поле чистое', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rect as unknown as ReturnType<HTMLElement['getBoundingClientRect']>
    )
    const w = keep(mount(PatternGrid, { global, attachTo: document.body }))
    const grid = w.element as HTMLElement
    grid.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 150 }))
    grid.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 150 }))
    grid.dispatchEvent(pointer('pointercancel'))
    expect(w.emitted('complete')).toBeUndefined()
    expect(grid.querySelectorAll('.on')).toHaveLength(0)
  })
})

describe('экран замка', () => {
  async function lockedWithPin(code: string): Promise<ReturnType<typeof useAppLockStore>> {
    vi.stubGlobal('navigator', { locks: undefined })
    expect((await ensureInitialized()).status).toBe('unlocked')
    const lock = useAppLockStore()
    await lock.enable('pin', code)
    lock.lock()
    return lock
  }

  it('закрывает приложение собой; неверный код — сообщение, верный — экран уходит', async () => {
    const lock = await lockedWithPin('2580')
    const app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)
    keep(mount(AppLockScreen, { global, attachTo: app }))
    await flushPromises()

    const screen = document.querySelector('[role="dialog"]') as HTMLElement
    expect(screen.textContent).toContain('Введите пин-код')
    expect(app.hasAttribute('inert')).toBe(true)

    tap(screen, '1111')
    // Подпись кода считает WebCrypto — не микрозадачами, ждём результат.
    await vi.waitFor(() => expect(screen.textContent).toContain('Неверный пин-код'))
    expect(lock.locked).toBe(true)

    await new Promise((r) => setTimeout(r, 500))
    tap(screen, '2580')
    await vi.waitFor(() => expect(lock.locked).toBe(false))
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(app.hasAttribute('inert')).toBe(false)
  })

  it('«Забыли пин-код?» — поле для фразы или ключа и выход из всех аккаунтов', async () => {
    await lockedWithPin('2580')
    keep(mount(AppLockScreen, { global, attachTo: document.body }))
    await flushPromises()
    const forgot = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Забыли пин-код?'
    )!
    forgot.click()
    await flushPromises()
    expect(document.querySelector('textarea')).not.toBeNull()
    expect(document.body.textContent).toContain('Войти без кода')
    expect(document.body.textContent).toContain('Записи нет? Выйти из всех аккаунтов')
  })
})
