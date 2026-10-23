/**
 * Участники открытой группы: из состояния Matrix-комнаты, с именами и
 * аватарами из профилей Bastyon, ролями и «скрыть сообщения» (matrix-ignore).
 *
 * Состав пересчитывается, когда список чатов пересобирает этот диалог: события
 * m.room.member и так перезагружают диалоги (use-matrix-listeners).
 */

import { computed, ref, watch, type Ref } from 'vue'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { userMark, type UserMark } from '@/helpers/profile/user-mark'
import { matrixService } from '../../services/matrix-service'
import { useMessengerStore } from '../../store'
import { chatUserName, getAddressFromMatrixId } from '../../helpers'
import {
  groupMembers,
  sortGroupMembers,
  type GroupMemberEntry,
  type GroupRoomLike,
} from '../../lib/group-chat'

export interface GroupMemberView extends GroupMemberEntry {
  /** Адрес Bastyon; null — участник не из Bastyon. */
  address: string | null
  name: string
  avatar?: string
  mark: UserMark | null
  isMe: boolean
  /** Его сообщения скрыты (matrix-ignore). */
  ignored: boolean
}

type LoadableRoom = GroupRoomLike & { loadMembersIfNeeded?: () => Promise<unknown> }

export function useGroupMembers(roomId: Ref<string | null>) {
  const store = useMessengerStore()
  /** Участники догрузились с сервера — перечитать комнату. */
  const loadedTick = ref(0)
  const ignored = ref<string[]>([])
  const ignoreBusy = ref(false)

  function getRoom(): LoadableRoom | null {
    const id = roomId.value
    return id ? (matrixService.getClient()?.getRoom?.(id) ?? null) : null
  }

  const entries = computed<GroupMemberEntry[] | null>(() => {
    void loadedTick.value
    // Диалог пересобран — состав мог измениться.
    void store.dialogs.find((d) => d.id === roomId.value)
    const room = getRoom()
    return room ? groupMembers(room) : null
  })

  const members = computed<GroupMemberView[]>(() => {
    const myId = matrixService.getClient()?.getUserId?.() || ''
    const list = (entries.value ?? []).map((e) => {
      const address = getAddressFromMatrixId(e.id)
      const p = address ? store.userProfiles[address] : undefined
      const img = p?.i || p?.avatar || p?.image
      return {
        ...e,
        address,
        name: chatUserName(e.id, store.userProfiles),
        avatar: typeof img === 'string' ? resolveImageUrl(img) : undefined,
        mark: address ? userMark(p, address) : null,
        isMe: e.id === myId,
        ignored: ignored.value.includes(e.id),
      }
    })
    return sortGroupMembers(list)
  })

  watch(
    roomId,
    async () => {
      ignored.value = matrixService.getClient()?.getIgnoredUsers?.() ?? []
      const room = getRoom()
      if (!room?.loadMembersIfNeeded) return
      try {
        await room.loadMembersIfNeeded()
        loadedTick.value++
      } catch {
        /* остаются те, кто уже пришёл с синком */
      }
    },
    { immediate: true }
  )

  // Имена и аватары — пачкой из профилей; кэш сам режет на запросы.
  watch(
    entries,
    (list) => {
      const missing = (list ?? [])
        .map((e) => getAddressFromMatrixId(e.id))
        .filter((a): a is string => !!a && !store.userProfiles[a])
      if (missing.length) void store.fetchProfiles(missing)
    },
    { immediate: true }
  )

  /** Скрыть или снова показать сообщения участника — как кнопка ⊘ в личном чате. */
  async function toggleIgnored(userId: string): Promise<void> {
    const client = matrixService.getClient()
    if (!client?.setIgnoredUsers || ignoreBusy.value) return
    ignoreBusy.value = true
    try {
      const next = new Set<string>(client.getIgnoredUsers?.() ?? [])
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      await client.setIgnoredUsers([...next])
      ignored.value = [...next]
    } catch {
      ignored.value = client.getIgnoredUsers?.() ?? []
    } finally {
      ignoreBusy.value = false
    }
  }

  return {
    members,
    /** Комнаты ещё нет на клиенте (список с прошлого запуска, синк не прошёл). */
    loaded: computed(() => entries.value !== null),
    ignoreBusy,
    toggleIgnored,
  }
}
