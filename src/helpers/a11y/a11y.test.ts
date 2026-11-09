// Помощники доступности: объявления для диктора, «Перейти к содержимому»,
// масштаб щипком, клавиатура у кнопок-div и выпадающих меню.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, withDirectives } from 'vue'

import { setI18nLocale } from '@/i18n'
import { announce, installLiveRegions } from './announce'
import {
  attachPopupKeys,
  focusMenu,
  isKeyboardClick,
  popupItems,
  vKeyActivate,
} from './key-activate'
import { focusMainContent } from './skip-to-content'
import { unreadLabel } from './unread-label'
import { allowPinchZoom, isIosBrowser, ZOOMABLE_VIEWPORT } from './viewport-zoom'

beforeAll(() => setI18nLocale('ru'))

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  vi.useRealTimers()
})

describe('announce — живые области для диктора', () => {
  it('области создаются заранее, по одной: вежливая и срочная', () => {
    installLiveRegions()
    installLiveRegions()
    const polite = document.querySelectorAll('[aria-live="polite"]')
    const assertive = document.querySelectorAll('[aria-live="assertive"]')
    expect(polite).toHaveLength(1)
    expect(assertive).toHaveLength(1)
    expect(polite[0]!.getAttribute('role')).toBe('status')
    expect(assertive[0]!.getAttribute('role')).toBe('alert')
    expect(polite[0]!.className).toBe('visually-hidden')
  })

  it('текст ставится после очистки — одинаковое объявление звучит снова', () => {
    vi.useFakeTimers()
    announce('Скопировано')
    vi.runAllTimers()
    const region = document.getElementById('a11y-live-polite')!
    expect(region.textContent).toBe('Скопировано')
    announce('Скопировано')
    expect(region.textContent).toBe('')
    vi.runAllTimers()
    expect(region.textContent).toBe('Скопировано')
  })

  it('ошибка — в срочную область, пустое не объявляется', () => {
    vi.useFakeTimers()
    installLiveRegions()
    announce('Не удалось отправить', 'assertive')
    announce('   ')
    vi.runAllTimers()
    expect(document.getElementById('a11y-live-assertive')!.textContent).toBe('Не удалось отправить')
    expect(document.getElementById('a11y-live-polite')!.textContent).toBe('')
  })
})

describe('focusMainContent — «Перейти к содержимому»', () => {
  it('фокус на <main>, в обход Tab она не попадает', () => {
    document.body.innerHTML = '<header><button>Меню</button></header><main>Лента</main>'
    expect(focusMainContent()).toBe(true)
    const main = document.querySelector('main')!
    expect(document.activeElement).toBe(main)
    expect(main.getAttribute('tabindex')).toBe('-1')
  })

  it('без <main> — ничего', () => {
    document.body.innerHTML = '<div>пусто</div>'
    expect(focusMainContent()).toBe(false)
  })
})

describe('unreadLabel — число со значка в названии кнопки', () => {
  it('есть непрочитанные — в названии', () => {
    expect(unreadLabel('Чаты', 3)).toBe('Чаты, непрочитанных: 3')
    expect(unreadLabel('Чаты', '99+')).toBe('Чаты, непрочитанных: 99+')
  })

  it('нет — только название', () => {
    expect(unreadLabel('Чаты', 0)).toBe('Чаты')
    expect(unreadLabel('Чаты', '')).toBe('Чаты')
    expect(unreadLabel('Чаты', undefined)).toBe('Чаты')
  })
})

describe('allowPinchZoom — масштаб щипком', () => {
  const VIEWPORT =
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  beforeEach(() => {
    document.head.innerHTML = `<meta name="viewport" content="${VIEWPORT}">`
  })
  const content = () => document.querySelector('meta[name="viewport"]')!.getAttribute('content')

  it('сайт в браузере телефона — запрет снят', () => {
    expect(allowPinchZoom({ native: false, ios: false })).toBe(true)
    expect(content()).toBe(ZOOMABLE_VIEWPORT)
  })

  it('приложение и Safari на iPhone — как было', () => {
    expect(allowPinchZoom({ native: true, ios: false })).toBe(false)
    expect(allowPinchZoom({ native: false, ios: true })).toBe(false)
    expect(content()).toBe(VIEWPORT)
  })

  it('iPhone и iPad (в том числе притворяющийся Маком) узнаются', () => {
    const ua = (s: string, touch = 0) => ({ userAgent: s, maxTouchPoints: touch })
    expect(isIosBrowser(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(true)
    expect(isIosBrowser(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))).toBe(true)
    expect(isIosBrowser(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0))).toBe(false)
    expect(isIosBrowser(ua('Mozilla/5.0 (Linux; Android 14) Chrome/130'))).toBe(false)
  })
})

describe('v-key-activate — Enter и пробел нажимают кнопку-div', () => {
  function mountWith(onClick: () => void) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const Comp = defineComponent({
      setup: () => () =>
        withDirectives(
          h('div', { role: 'button', tabindex: 0, onClick, 'data-testid': 'btn' }, [
            h('input', { 'data-testid': 'field' }),
          ]),
          [[vKeyActivate]]
        ),
    })
    const app = createApp(Comp)
    app.mount(host)
    return app
  }
  const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
    el.dispatchEvent(e)
    return e
  }

  it('Enter и пробел — щелчок, без прокрутки страницы', () => {
    const onClick = vi.fn()
    const app = mountWith(onClick)
    const btn = document.querySelector('[data-testid="btn"]')!
    expect(key(btn, 'Enter').defaultPrevented).toBe(true)
    expect(key(btn, ' ').defaultPrevented).toBe(true)
    expect(onClick).toHaveBeenCalledTimes(2)
    app.unmount()
  })

  it('Enter в поле внутри, с Ctrl, повтор и другие клавиши — не щелчок', () => {
    const onClick = vi.fn()
    const app = mountWith(onClick)
    const btn = document.querySelector('[data-testid="btn"]')!
    key(document.querySelector('[data-testid="field"]')!, 'Enter')
    key(btn, 'Enter', { ctrlKey: true })
    key(btn, 'Enter', { repeat: true })
    key(btn, 'a')
    expect(onClick).not.toHaveBeenCalled()
    app.unmount()
  })
})

describe('клавиши в меню', () => {
  function menu(): { trigger: HTMLButtonElement; popup: HTMLElement; items: HTMLElement[] } {
    document.body.innerHTML = `
      <button id="trigger">⋯</button>
      <div id="popup" role="menu">
        <div role="menuitem" tabindex="-1">Первый</div>
        <div role="menuitem" tabindex="-1" aria-disabled="true">Нельзя</div>
        <div role="menuitem" tabindex="-1">Второй</div>
        <button>Третий</button>
      </div>`
    const popup = document.getElementById('popup')!
    return {
      trigger: document.getElementById('trigger') as HTMLButtonElement,
      popup,
      items: popupItems(popup),
    }
  }
  const press = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

  it('пункты по порядку, недоступный пропущен', () => {
    const { items } = menu()
    expect(items.map((el) => el.textContent)).toEqual(['Первый', 'Второй', 'Третий'])
  })

  it('фокус на первый пункт; стрелки по кругу, Home и End', () => {
    const { trigger, popup, items } = menu()
    focusMenu(popup, trigger, vi.fn())
    expect(document.activeElement).toBe(items[0])
    press(items[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(items[1])
    press(items[1]!, 'ArrowDown')
    press(items[2]!, 'ArrowDown')
    expect(document.activeElement).toBe(items[0])
    press(items[0]!, 'ArrowUp')
    expect(document.activeElement).toBe(items[2])
    press(items[2]!, 'Home')
    expect(document.activeElement).toBe(items[0])
    press(items[0]!, 'End')
    expect(document.activeElement).toBe(items[2])
  })

  it('Enter на пункте-div — щелчок; Esc закрывает и возвращает фокус на кнопку', () => {
    const { trigger, popup, items } = menu()
    const close = vi.fn()
    const picked = vi.fn()
    items[0]!.addEventListener('click', picked)
    attachPopupKeys(popup, trigger, close)
    items[0]!.focus()
    press(items[0]!, 'Enter')
    expect(picked).toHaveBeenCalledTimes(1)
    press(items[0]!, 'Escape')
    expect(close).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(trigger)
  })

  it('щелчок с клавиатуры узнаётся по detail = 0', () => {
    expect(isKeyboardClick(new MouseEvent('click', { detail: 0 }))).toBe(true)
    expect(isKeyboardClick(new MouseEvent('click', { detail: 1 }))).toBe(false)
  })
})
