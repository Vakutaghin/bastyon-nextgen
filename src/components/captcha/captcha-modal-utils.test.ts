// Окно капчи при регистрации и запросе бесплатного баланса: промис отдаёт
// решённую капчу или отказ, окно снимается со страницы ровно один раз.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import type { useCaptchaModal } from './captcha-modal'

const state = vi.hoisted(() => ({
  modal: null as null | {
    api: ReturnType<typeof useCaptchaModal>
    props: { open?: boolean; captcha: CaptchaData | null; reason?: string }
  },
  captchaGet: vi.fn(),
}))

vi.mock('@/blockchain/api/captcha-api', () => ({
  captchaAPI: { get: (...args: unknown[]) => state.captchaGet(...args) },
}))

// Окно — та же логика useCaptchaModal, что у настоящего, без разметки antd и
// картинки капчи: события уходят в том же порядке.
vi.mock('./captcha-modal.vue', async () => {
  const { defineComponent, h } = await import('vue')
  const { useCaptchaModal } = await import('./captcha-modal')
  return {
    default: defineComponent({
      props: {
        open: { type: Boolean, default: false },
        captcha: { type: Object, default: null },
        reason: { type: String, default: undefined },
        proxyOptions: { type: Object, default: undefined },
      },
      emits: ['update:open', 'success', 'error', 'cancel', 'redo'],
      setup(props, { emit }) {
        const api = useCaptchaModal(
          props as unknown as Parameters<typeof useCaptchaModal>[0],
          emit as unknown as Parameters<typeof useCaptchaModal>[1]
        )
        state.modal = { api, props: props as unknown as NonNullable<typeof state.modal>['props'] }
        return () => h('div', { 'data-testid': 'captcha-modal', 'data-open': String(props.open) })
      },
    }),
  }
})

import { showCaptchaModal } from './captcha-modal-utils'

const CAPTCHA: CaptchaData = { id: 'c1', img: '<svg/>' }
const modal = () => state.modal!

/** Сколько раз окно убирали со страницы: контейнер, который утилита добавила в body. */
function watchRemoval(): () => number {
  const append = vi.spyOn(document.body, 'appendChild')
  return () => {
    const container = append.mock.results[0]?.value as HTMLElement | undefined
    return container ? (removals.get(container) ?? 0) : 0
  }
}
const removals = new WeakMap<Element, number>()

describe('showCaptchaModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.modal = null
    state.captchaGet.mockReset()
    const remove = Element.prototype.remove
    vi.spyOn(Element.prototype, 'remove').mockImplementation(function (this: Element) {
      removals.set(this, (removals.get(this) ?? 0) + 1)
      remove.call(this)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('показывает окно с капчей и причиной', async () => {
    void showCaptchaModal({ captcha: CAPTCHA, reason: 'registration' }).catch(() => {})
    expect(document.querySelector('[data-testid=captcha-modal]')?.getAttribute('data-open')).toBe(
      'true'
    )
    expect(modal().props.captcha).toEqual(CAPTCHA)
    expect(modal().props.reason).toBe('registration')
  })

  it('решённая капча — промис отдаёт её, окно уходит со страницы', async () => {
    const result = showCaptchaModal({ captcha: CAPTCHA })
    const solved = { ...CAPTCHA, done: true, result: 'ok' }
    modal().api.handleSuccess(solved)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(solved)
    expect(document.querySelector('[data-testid=captcha-modal]')).toBeNull()
    expect(document.body.children).toHaveLength(0)
  })

  it('после решения окно не снимается второй раз', async () => {
    const removed = watchRemoval()
    const result = showCaptchaModal({ captcha: CAPTCHA })
    modal().api.handleSuccess({ ...CAPTCHA, done: true })
    await vi.runAllTimersAsync()
    await result
    // Успех закрывает окно через update:open(false). Утилита слушает его как
    // onUpdateOpen, а Vue зовёт onUpdate:open — до неё событие не доходит. Дойди
    // оно — следом пошла бы «отмена»: второй unmount и отказ через 300 мс.
    expect(removed()).toBe(1)
  })

  it('«Отмена» — промис отклоняется, окно уходит один раз', async () => {
    const removed = watchRemoval()
    const result = showCaptchaModal({ captcha: CAPTCHA })
    const rejected = expect(result).rejects.toThrow('Captcha cancelled')
    modal().api.handleCancel()
    await vi.runAllTimersAsync()
    await rejected
    expect(document.body.children).toHaveLength(0)
    expect(removed()).toBe(1)
  })

  it('неверный ответ окно не закрывает: можно попробовать ещё', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const settled = vi.fn()
    void showCaptchaModal({ captcha: CAPTCHA }).then(settled, settled)
    modal().api.handleError('Неверный код')
    await vi.runAllTimersAsync()
    expect(settled).not.toHaveBeenCalled()
    expect(modal().api.error.value).toBe('Неверный код')
    expect(document.querySelector('[data-testid=captcha-modal]')?.getAttribute('data-open')).toBe(
      'true'
    )
  })

  it('«Другая картинка» — новая капча через тот же прокси', async () => {
    const fresh: CaptchaData = { id: 'c2', img: '<svg>2</svg>' }
    state.captchaGet.mockResolvedValue(fresh)
    void showCaptchaModal({ captcha: CAPTCHA, proxyOptions: { proxy: 'p1' } }).catch(() => {})
    await modal().api.handleRedo()
    await vi.runAllTimersAsync()
    expect(state.captchaGet).toHaveBeenCalledWith(undefined, true, { proxy: 'p1' })
    expect(modal().props.captcha).toEqual(fresh)
  })

  it('новая капча не пришла — остаётся прежняя, окно открыто', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.captchaGet.mockRejectedValue(new Error('network'))
    void showCaptchaModal({ captcha: CAPTCHA }).catch(() => {})
    await modal().api.handleRedo()
    await vi.runAllTimersAsync()
    expect(modal().props.captcha).toEqual(CAPTCHA)
    expect(modal().props.open).toBe(true)
  })
})
