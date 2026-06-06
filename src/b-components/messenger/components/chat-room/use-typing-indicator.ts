/**
 * Typing-индикатор для активной комнаты. Слушает события Matrix
 * `RoomMember.typing` напрямую на клиенте (matrix-service не имеет `off`,
 * поэтому подписываемся/отписываемся через raw-client для корректного lifecycle).
 *
 * Логика обновления множества «печатающих» вынесена в чистую {@link applyTypingEvent}
 * — тестируется без Matrix.
 */

import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { matrixService } from '../../services/matrix-service'

export interface TypingMember {
  userId: string
  roomId: string
  typing: boolean
}

export interface TypingContext {
  /** Активная комната (для которой показываем индикатор). */
  roomId: string | null
  /** Мой userId — себя не показываем. */
  myId: string | null
}

/**
 * Обновляет множество печатающих userId для активной комнаты.
 * Возвращает НОВОЕ множество (или прежнее, если событие нерелевантно).
 */
export function applyTypingEvent(
  current: ReadonlySet<string>,
  member: TypingMember,
  ctx: TypingContext
): Set<string> {
  if (!ctx.roomId || member.roomId !== ctx.roomId) return new Set(current)
  if (member.userId && member.userId === ctx.myId) return new Set(current)
  const next = new Set(current)
  if (member.typing) next.add(member.userId)
  else next.delete(member.userId)
  return next
}

const TYPING_EVENT = 'RoomMember.typing'

export function useTypingIndicator(activeRoomId: Ref<string | null>) {
  const typingIds = ref<Set<string>>(new Set())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RoomMember из matrix-js-sdk потребляется duck-typing'ом, как и в сторах
  function onTyping(_event: unknown, member: any): void {
    if (!member) return
    const myId = matrixService.getClient()?.getUserId?.() ?? null
    typingIds.value = applyTypingEvent(
      typingIds.value,
      { userId: member.userId, roomId: member.roomId, typing: !!member.typing },
      { roomId: activeRoomId.value, myId }
    )
  }

  /** Имя первого печатающего (для текста индикатора), либо null. */
  const typingName = computed<string | null>(() => {
    const first = [...typingIds.value][0]
    if (!first) return null
    const client = matrixService.getClient()
    const rid = activeRoomId.value
    const member = rid ? client?.getRoom?.(rid)?.getMember?.(first) : null
    return member?.name || member?.rawDisplayName || null
  })

  const isTyping = computed<boolean>(() => typingIds.value.size > 0)

  // Смена комнаты — сбрасываем индикатор.
  watch(activeRoomId, () => {
    typingIds.value = new Set()
  })

  onMounted(() => {
    matrixService.getClient()?.on?.(TYPING_EVENT, onTyping)
  })
  onBeforeUnmount(() => {
    matrixService.getClient()?.off?.(TYPING_EVENT, onTyping)
  })

  return { isTyping, typingName }
}
