/**
 * Упоминание в группе, как в Telegram: набрали «@» — над полем ввода список
 * участников, дальше буквы сужают его; стрелки и Enter (Tab) — выбрать с
 * клавиатуры, нажатие — пальцем или мышью, Esc — закрыть. В поле встаёт
 * «@имя », а в сообщение уходит `@hex:имя` (lib/mentions) — его читают и
 * прежний Bastyon, и Forta Chat.
 *
 * Участники — те же, что в «Сообщениях участника» и сведениях о группе
 * (useGroupMembers): вступившие, кроме вас, у кого есть адрес Bastyon. Их
 * состав и профили грузятся, только когда в поле появилась «@»: открыть
 * группу на сотни человек — ещё не повод качать всех.
 */

import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { useGroupMembers, type GroupMemberView } from '../group-info/use-group-members'
import {
  encodeMentions,
  insertMentionAt,
  mentionQueryAt,
  type MentionMember,
  type MentionQuery,
} from '../../lib/mentions'

/** Больше в списке не показываем: дальше сужают буквами. */
const MAX_SHOWN = 50

export interface MentionPickerOptions {
  /** Комната группы; null — не группа (в личном чате упоминать некого). */
  roomId: Ref<string | null>
  text: Ref<string>
  input: () => HTMLTextAreaElement | null
  /** Текст поменялся не набором (вставили участника): поле — по высоте. */
  onChange?: () => void
}

export function useMentionPicker(opts: MentionPickerOptions) {
  /** Группа, где упоминают; до первой «@» — null, участники не грузятся. */
  const wanted = ref<string | null>(null)
  const { members } = useGroupMembers(wanted)
  const at = ref<MentionQuery | null>(null)
  const active = ref(0)

  /** Кого можно упомянуть: вступившие, не вы, с адресом Bastyon. */
  const candidates = computed<Array<GroupMemberView & { address: string }>>(() =>
    members.value.filter(
      (m): m is GroupMemberView & { address: string } =>
        m.membership === 'join' && !m.isMe && !!m.address
    )
  )

  const shown = computed(() => {
    if (!at.value) return []
    const q = at.value.query.toLowerCase()
    const list = q
      ? candidates.value.filter(
          (m) => m.name.toLowerCase().includes(q) || m.address.toLowerCase().startsWith(q)
        )
      : candidates.value
    return list.slice(0, MAX_SHOWN)
  })

  /** Список открыт: набирают упоминание и есть кого показать. */
  const open = computed<boolean>(() => !!at.value && shown.value.length > 0)

  watch(
    () => at.value?.query,
    () => {
      active.value = 0
    }
  )
  watch(opts.roomId, () => {
    wanted.value = null
    close()
  })
  watch(
    () => [opts.text.value.includes('@'), opts.roomId.value] as const,
    ([typed, room]) => {
      if (typed && room && wanted.value !== room) wanted.value = room
    },
    { immediate: true }
  )

  /** Каретка сдвинулась или текст поменялся: набирают ли упоминание. */
  function update(): void {
    const el = opts.input()
    if (!opts.roomId.value || !el || el.selectionStart !== el.selectionEnd) {
      at.value = null
      return
    }
    at.value = mentionQueryAt(opts.text.value, el.selectionStart ?? opts.text.value.length)
  }

  function close(): void {
    at.value = null
  }

  function pick(member: { address: string; name: string }): void {
    const el = opts.input()
    const query = at.value
    if (!query) return
    const caret = el?.selectionStart ?? opts.text.value.length
    const next = insertMentionAt(opts.text.value, query, caret, member.name, member.address)
    opts.text.value = next.text
    at.value = null
    void nextTick(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = next.caret
      opts.onChange?.()
    })
  }

  /** Клавиша в поле; true — её забрал список (поле её не обрабатывает). */
  function keydown(e: KeyboardEvent): boolean {
    if (!open.value) return false
    const n = shown.value.length
    switch (e.key) {
      case 'ArrowDown':
        active.value = (active.value + 1) % n
        break
      case 'ArrowUp':
        active.value = (active.value - 1 + n) % n
        break
      case 'Enter':
      case 'Tab':
        if (e.shiftKey) return false
        pick(shown.value[Math.min(active.value, n - 1)]!)
        break
      case 'Escape':
        // Esc закрывает только список, а не чат под ним.
        e.stopPropagation()
        close()
        break
      default:
        return false
    }
    e.preventDefault()
    return true
  }

  /** Перед отправкой: «@имя» участников — в `@hex:имя`. В личном чате — как есть. */
  function encode(text: string): string {
    if (!opts.roomId.value) return text
    const list: MentionMember[] = members.value.flatMap((m) =>
      m.address ? [{ address: m.address, name: m.name }] : []
    )
    return encodeMentions(text, list)
  }

  return { open, shown, active, update, close, pick, keydown, encode }
}

export type MentionPicker = ReturnType<typeof useMentionPicker>
