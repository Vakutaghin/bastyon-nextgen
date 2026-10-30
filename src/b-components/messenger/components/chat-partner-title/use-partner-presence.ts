/**
 * «В сети» / «был(а) в сети 5 минут назад» под именем собеседника.
 *
 * Показывается, только если вы сами сообщаете, что в сети (как в Telegram:
 * скрыли свой статус — не видите чужие), и собеседник делится своим: прежний
 * клиент Bastyon и NextGen с выключенной настройкой ничего не шлют.
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import { matrixService } from '../../services/matrix-service'
import { resolveMatrixHost } from '../../helpers'

export interface PresenceInfo {
  online: boolean
  lastActiveAt: number | null
}

/** Текст статуса или null, если показывать нечего. */
export function presenceLabel(
  info: PresenceInfo | null,
  t: (key: string, values?: Record<string, unknown>) => string,
  nowMs: number = Date.now()
): string | null {
  if (!info) return null
  if (info.online) return t('messenger.presence.online')
  if (!info.lastActiveAt) return null
  return t('messenger.presence.lastSeen', {
    ago: formatTimeAgo(Math.floor(info.lastActiveAt / 1000), Math.floor(nowMs / 1000)),
  })
}

const PRESENCE_EVENTS = ['User.presence', 'User.currentlyActive', 'User.lastPresenceTs']
/** «5 минут назад» обновляется само. */
const TICK_MS = 30_000

export function usePartnerPresence(address: () => string | null, enabled: () => boolean) {
  const { t } = useI18n()
  /** Растёт с каждым событием присутствия — пересчитать статус. */
  const version = ref(0)
  const now = ref(Date.now())
  let tick: ReturnType<typeof setInterval> | null = null

  const userId = computed<string | null>(() => {
    const a = address()
    return a ? `@${matrixService.addressToHex(a).toLowerCase()}:${resolveMatrixHost()}` : null
  })

  const label = computed<string | null>(() => {
    void version.value
    const id = userId.value
    if (!id || !enabled()) return null
    return presenceLabel(matrixService.getUserPresence(id), t, now.value)
  })

  function bump(_event: unknown, user?: { userId?: string }): void {
    if (!user?.userId || user.userId === userId.value) version.value += 1
  }

  // `User.*` SDK пробрасывает на клиент не всегда (как и `RoomMember.typing`) —
  // `m.presence` из синка приходит событием клиента `event` наверняка.
  function onEvent(event: { getType?: () => string; getSender?: () => string }): void {
    if (event?.getType?.() !== 'm.presence') return
    const sender = event.getSender?.()
    if (!sender || sender === userId.value) version.value += 1
  }

  onMounted(() => {
    const client = matrixService.getClient()
    for (const name of PRESENCE_EVENTS) client?.on?.(name, bump)
    client?.on?.('event', onEvent)
    tick = setInterval(() => (now.value = Date.now()), TICK_MS)
  })
  onBeforeUnmount(() => {
    const client = matrixService.getClient()
    for (const name of PRESENCE_EVENTS) client?.off?.(name, bump)
    client?.off?.('event', onEvent)
    if (tick) clearInterval(tick)
  })

  return { label }
}
