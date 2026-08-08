/**
 * Блокировка собеседника на уровне Matrix (ignore — `m.ignored_user_list`).
 * Чисто фронтовый account-data API (`getIgnoredUsers`/`setIgnoredUsers`), без
 * on-chain/транзакций. Это messenger-level mute (скрывает сообщения), отдельно
 * от on-chain blacklist в социальном графе.
 *
 * NB: непроверяемо без живого Matrix — логика по стандартному matrix-js-sdk.
 */

import { onMounted, ref, watch, type Ref } from 'vue'
import { matrixService } from '../../services/matrix-service'

export function useBlockUser(activeRoomId: Ref<string | null>) {
  const isBlocked = ref(false)
  const busy = ref(false)

  function partnerId(): string | null {
    const client = matrixService.getClient()
    const rid = activeRoomId.value
    if (!client || !rid) return null
    try {
      const room = client.getRoom?.(rid)
      const myId = client.getUserId?.()
      if (!room) return null
      // Сначала joined, затем invited: у свежего DM собеседник ещё лишь приглашён
      // (не joined), и поиск только по joined возвращал null — кнопка молча не
      // срабатывала. Тот же случай, что и в mapRoomToDialog.
      let partner = room
        .getJoinedMembers?.()
        ?.find((m: { userId?: string }) => m.userId && m.userId !== myId)
      if (!partner) {
        partner = room.currentState
          ?.getMembers?.()
          ?.find(
            (m: { userId?: string; membership?: string }) =>
              m.userId &&
              m.userId !== myId &&
              (m.membership === 'join' || m.membership === 'invite')
          )
      }
      return partner?.userId ?? null
    } catch {
      return null
    }
  }

  function refresh(): void {
    const client = matrixService.getClient()
    const pid = partnerId()
    const ignored: string[] = client?.getIgnoredUsers?.() ?? []
    isBlocked.value = !!pid && ignored.includes(pid)
  }

  async function toggleBlock(): Promise<void> {
    const client = matrixService.getClient()
    const pid = partnerId()
    if (!client || !pid || busy.value) return
    busy.value = true
    try {
      const ignored = new Set<string>(client.getIgnoredUsers?.() ?? [])
      if (ignored.has(pid)) ignored.delete(pid)
      else ignored.add(pid)
      await client.setIgnoredUsers?.([...ignored])
      isBlocked.value = ignored.has(pid)
    } catch {
      // Сервер не принял — пере-синхронизируемся с фактическим состоянием.
      refresh()
    } finally {
      busy.value = false
    }
  }

  watch(activeRoomId, refresh)
  onMounted(refresh)

  return { isBlocked, busy, toggleBlock }
}
