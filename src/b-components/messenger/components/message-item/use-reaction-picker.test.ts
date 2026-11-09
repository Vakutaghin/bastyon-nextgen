// Пикер реакций под сообщением: открывается только там, где можно реагировать,
// встаёт над кнопкой (или под ней) в пределах ленты, закрывается выбором,
// щелчком мимо и прокруткой ленты, и не оставляет слушателей на документе.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

import { useReactionPicker } from './use-reaction-picker'

type Rect = { top: number; bottom: number; left: number; right: number }

function setRect(el: HTMLElement, r: Rect) {
  el.getBoundingClientRect = () =>
    ({
      ...r,
      x: r.left,
      y: r.top,
      width: r.right - r.left,
      height: r.bottom - r.top,
      toJSON: () => r,
    }) as DOMRect
}

let wrapper: VueWrapper | null = null
const nodes: HTMLElement[] = []

/** Лента (прокручиваемая) с кнопкой реакции внутри и сам пикер. */
function setup(opts: { canReact?: boolean; container?: Rect; trigger?: Rect; picker?: Rect } = {}) {
  const canReact = ref(opts.canReact ?? true)
  const onReact = vi.fn()
  let api!: ReturnType<typeof useReactionPicker>
  wrapper = mount(
    defineComponent({
      setup() {
        api = useReactionPicker({ canReact, onReact })
        return () => h('div')
      },
    })
  )

  const feed = document.createElement('div')
  feed.style.overflowY = 'auto'
  const trigger = document.createElement('button')
  const triggerIcon = document.createElement('span')
  trigger.appendChild(triggerIcon)
  feed.appendChild(trigger)
  const picker = document.createElement('div')
  const emoji = document.createElement('button')
  picker.appendChild(emoji)
  const outside = document.createElement('p')
  document.body.append(feed, picker, outside)
  nodes.push(feed, picker, outside)

  setRect(feed, opts.container ?? { top: 100, bottom: 700, left: 0, right: 400 })
  setRect(trigger, opts.trigger ?? { top: 400, bottom: 430, left: 50, right: 80 })
  setRect(picker, opts.picker ?? { top: 0, bottom: 44, left: 0, right: 220 })

  // Кнопка — styled-компонент: узел у него в $el.
  api.reactionTriggerRef.value = { $el: trigger }
  api.reactionPickerRef.value = picker
  return { ...api, canReact, onReact, feed, trigger, triggerIcon, picker, emoji, outside }
}

/** Позиция считается через два nextTick после открытия. */
const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
/** Щелчок-мимо подписывается в следующем тике таймера (чтобы не поймать открывший щелчок). */
const clickListenerArmed = () => new Promise((r) => setTimeout(r, 0))

// По спецификации DOM addEventListener(type, null) ничего не делает; happy-dom
// регистрирует null и падает на следующем щелчке. Возвращаем браузерное поведение.
beforeEach(() => {
  const realAdd = document.addEventListener.bind(document)
  vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) => {
    if (listener) realAdd(type, listener, options)
  }) as unknown as typeof document.addEventListener)
})

afterEach(async () => {
  // Отложенная подписка щелчка-мимо должна отработать до размонтирования.
  await clickListenerArmed()
  wrapper?.unmount()
  wrapper = null
  nodes.splice(0).forEach((n) => n.remove())
  vi.restoreAllMocks()
})

describe('открытие и выбор', () => {
  it('на своё/локальное сообщение реагировать нельзя — пикер не открывается, реакция не уходит', async () => {
    const p = setup({ canReact: false })
    p.toggleReactionPicker()
    await settle()
    expect(p.showReactionPicker.value).toBe(false)
    expect(p.pickerStyle.value).toBeNull()

    p.onReactionClick('👍')
    expect(p.onReact).not.toHaveBeenCalled()
  })

  it('выбор реакции отправляет её и закрывает пикер', async () => {
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    expect(p.showReactionPicker.value).toBe(true)

    p.onReactionClick('❤️')
    expect(p.onReact).toHaveBeenCalledWith('❤️')
    expect(p.showReactionPicker.value).toBe(false)
    expect(p.pickerStyle.value).toBeNull()
  })

  it('повторное нажатие на кнопку закрывает пикер', async () => {
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    p.toggleReactionPicker()
    await settle()
    expect(p.showReactionPicker.value).toBe(false)
    expect(p.pickerStyle.value).toBeNull()
  })
})

describe('позиция пикера', () => {
  it('место над кнопкой есть — встаёт над ней, поверх всего, у левого края кнопки', async () => {
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    expect(p.pickerStyle.value).toEqual({
      position: 'fixed',
      top: `${400 - 44 - 4}px`,
      left: '50px',
      right: 'auto',
      bottom: 'auto',
      zIndex: 10000,
    })
  })

  it('сверху ленты места нет — под кнопкой', async () => {
    const p = setup({ trigger: { top: 120, bottom: 150, left: 50, right: 80 } })
    p.toggleReactionPicker()
    await settle()
    expect(p.pickerStyle.value?.top).toBe(`${150 + 4}px`)
  })

  it('лента низкая, места нет ни сверху, ни снизу — прижимается внутрь ленты', async () => {
    const p = setup({
      container: { top: 100, bottom: 160, left: 0, right: 400 },
      trigger: { top: 110, bottom: 150, left: 50, right: 80 },
    })
    p.toggleReactionPicker()
    await settle()
    expect(p.pickerStyle.value?.top).toBe(`${100 + 8}px`)
  })

  it('не вылезает за правый и левый край ленты', async () => {
    const right = setup({ trigger: { top: 400, bottom: 430, left: 300, right: 330 } })
    right.toggleReactionPicker()
    await settle()
    expect(right.pickerStyle.value?.left).toBe(`${400 - 220 - 8}px`)
    await clickListenerArmed()
    wrapper!.unmount()

    const left = setup({
      container: { top: 100, bottom: 700, left: 100, right: 600 },
      trigger: { top: 400, bottom: 430, left: 50, right: 80 },
    })
    left.toggleReactionPicker()
    await settle()
    expect(left.pickerStyle.value?.left).toBe(`${100 + 8}px`)
  })

  it('пикер ещё не измерен (нулевой размер) — считается по размеру по умолчанию', async () => {
    const p = setup({
      picker: { top: 0, bottom: 0, left: 0, right: 0 },
      trigger: { top: 400, bottom: 430, left: 300, right: 330 },
    })
    p.toggleReactionPicker()
    await settle()
    expect(p.pickerStyle.value).toMatchObject({ top: `${400 - 44 - 4}px`, left: '172px' })
  })

  it('узлов нет (компонент ещё не отрисован) — позиция не считается, без ошибок', async () => {
    const p = setup()
    p.reactionPickerRef.value = null
    p.toggleReactionPicker()
    await settle()
    expect(p.showReactionPicker.value).toBe(true)
    expect(p.pickerStyle.value).toBeNull()
  })
})

describe('закрытие и слушатели', () => {
  it('щелчок мимо закрывает; щелчок по пикеру или кнопке — нет', async () => {
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    await clickListenerArmed()

    p.emoji.click()
    p.triggerIcon.click()
    expect(p.showReactionPicker.value).toBe(true)

    p.outside.click()
    expect(p.showReactionPicker.value).toBe(false)
    expect(p.pickerStyle.value).toBeNull()
  })

  it('прокрутка ленты закрывает пикер', async () => {
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    p.feed.dispatchEvent(new Event('scroll'))
    expect(p.showReactionPicker.value).toBe(false)
  })

  it('после закрытия слушатели щелчка-мимо и прокрутки сняты', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    await clickListenerArmed()
    const clickHandler = add.mock.calls.find(
      (c) => c[0] === 'click' && typeof c[1] === 'function'
    )?.[1]
    expect(clickHandler).toBeTypeOf('function')
    const feedRemove = vi.spyOn(p.feed, 'removeEventListener')

    p.toggleReactionPicker()
    await settle()
    expect(remove).toHaveBeenCalledWith('click', clickHandler, true)
    expect(feedRemove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })

  it('пикер открыли, и сообщение ушло в тот же такт — щелчок-мимо не повисает на document', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const p = setup()
    p.toggleReactionPicker()
    await nextTick()
    wrapper!.unmount()
    wrapper = null
    await clickListenerArmed()
    expect(add.mock.calls.filter((c) => c[0] === 'click')).toHaveLength(0)
  })

  it('открыли и сразу закрыли — щелчок-мимо не вешается', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const p = setup()
    p.toggleReactionPicker()
    await nextTick()
    p.toggleReactionPicker()
    await nextTick()
    await clickListenerArmed()
    expect(add.mock.calls.filter((c) => c[0] === 'click')).toHaveLength(0)
  })

  it('сообщение ушло из ленты с открытым пикером — слушатели сняты', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const add = vi.spyOn(document, 'addEventListener')
    const p = setup()
    p.toggleReactionPicker()
    await settle()
    await clickListenerArmed()
    const clickHandler = add.mock.calls.find(
      (c) => c[0] === 'click' && typeof c[1] === 'function'
    )?.[1]
    const feedRemove = vi.spyOn(p.feed, 'removeEventListener')

    wrapper!.unmount()
    wrapper = null
    expect(remove).toHaveBeenCalledWith('click', clickHandler, true)
    expect(feedRemove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })
})
