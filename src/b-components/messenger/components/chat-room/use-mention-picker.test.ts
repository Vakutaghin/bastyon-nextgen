// «@» в группе — список участников над полем: буквы сужают, стрелки и Enter
// выбирают, Esc закрывает только список. В поле — «@имя », в сообщение —
// `@hex:имя`. Участники грузятся, только когда в поле появилась «@».

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { addressToHex } from '../../services/matrix-service/address-codec'

const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CAROL = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'

const group = vi.hoisted(() => ({ asked: [] as Array<string | null> }))
vi.mock('../group-info/use-group-members', async () => {
  const { computed, watch } = await import('vue')
  return {
    useGroupMembers: (roomId: Ref<string | null>) => {
      watch(roomId, (id) => group.asked.push(id), { immediate: true })
      const all = [
        { id: '@bob', membership: 'join', address: BOB, name: 'bob_ng', isMe: false },
        { id: '@carol', membership: 'join', address: CAROL, name: 'Кэрол', isMe: false },
        { id: '@me', membership: 'join', address: ME, name: 'me_ng', isMe: true },
        { id: '@dan', membership: 'invite', address: 'PDan', name: 'dan', isMe: false },
      ]
      return { members: computed(() => (roomId.value ? all : [])) }
    },
  }
})

import { useMentionPicker, type MentionPicker } from './use-mention-picker'

let textarea: HTMLTextAreaElement
let text: Ref<string>
let roomId: Ref<string | null>
let picker: MentionPicker
let wrapper: ReturnType<typeof mount> | null = null

function setup(room: string | null = '!g:host'): void {
  textarea = document.createElement('textarea')
  document.body.appendChild(textarea)
  text = ref('')
  roomId = ref(room)
  wrapper = mount(
    defineComponent({
      setup() {
        picker = useMentionPicker({ roomId, text, input: () => textarea })
        return () => h('div')
      },
    })
  )
}

/** Набрали: текст и каретка в конце. */
async function type(value: string): Promise<void> {
  text.value = value
  textarea.value = value
  textarea.selectionStart = textarea.selectionEnd = value.length
  await nextTick()
  picker.update()
  await nextTick()
}

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true })

beforeEach(() => {
  group.asked.length = 0
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  textarea.remove()
})

describe('useMentionPicker', () => {
  it('участники грузятся с первой «@»; список — вступившие, без вас', async () => {
    setup()
    await type('привет')
    expect(group.asked.filter(Boolean)).toEqual([])
    await type('привет @')
    expect(group.asked.filter(Boolean)).toEqual(['!g:host'])
    expect(picker.open.value).toBe(true)
    expect(picker.shown.value.map((m) => m.name)).toEqual(['bob_ng', 'Кэрол'])
  })

  it('буквы сужают список; никого — список закрыт', async () => {
    setup()
    await type('@кэ')
    expect(picker.shown.value.map((m) => m.name)).toEqual(['Кэрол'])
    await type('@zzz')
    expect(picker.open.value).toBe(false)
  })

  it('стрелки и Enter: в поле «@имя », а в сообщение — @hex:имя', async () => {
    setup()
    await type('глянь @')
    expect(picker.keydown(key('ArrowDown'))).toBe(true)
    expect(picker.active.value).toBe(1)
    const enter = key('Enter')
    expect(picker.keydown(enter)).toBe(true)
    expect(enter.defaultPrevented).toBe(true)
    expect(text.value).toBe('глянь @Кэрол ')
    expect(picker.open.value).toBe(false)
    expect(picker.encode(text.value)).toBe(`глянь @${addressToHex(CAROL)}:Кэрол `)
  })

  it('Esc закрывает только список; закрыт — клавиши достаются полю', async () => {
    setup()
    await type('@')
    const esc = key('Escape')
    const outside = vi.fn()
    textarea.addEventListener('keydown', (e) => picker.keydown(e))
    document.addEventListener('keydown', outside)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(outside).not.toHaveBeenCalled()
    expect(picker.open.value).toBe(false)
    expect(picker.keydown(esc)).toBe(false)
    expect(picker.keydown(key('Enter'))).toBe(false)
    document.removeEventListener('keydown', outside)
  })

  it('не группа — ни списка, ни замены', async () => {
    setup(null)
    await type('@bo')
    expect(picker.open.value).toBe(false)
    expect(picker.encode('@bob_ng')).toBe('@bob_ng')
  })
})
