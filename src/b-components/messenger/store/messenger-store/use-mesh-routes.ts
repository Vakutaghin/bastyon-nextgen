/**
 * «Один диалог — несколько маршрутов» (этап 8 плана mesh-сетей). У человека,
 * который поделился адресом Reticulum (проверенная запись связки,
 * src/mesh/binding.ts), диалог Bastyon продолжается через Reticulum, когда
 * сервер чатов недоступен, — или всегда, если так выбрать в чате.
 *
 * - Сообщения LXMF с ним показываются в том же чате, по времени; отдельный
 *   LXMF-диалог в списке прячется, свежее и непрочитанное — в диалоге Bastyon.
 * - Отправка: сервер на связи — как обычно; нет — через Reticulum.
 * - История LXMF хранится локально, как у всех mesh-диалогов: на другом
 *   устройстве её нет, в Matrix она не попадает.
 */

import { computed, ref } from 'vue'

import { directDialogId } from '@/mesh/ids'
import type { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshRoutesStore, type MeshRoute } from '@/mesh/store/mesh-routes-store'
import { mergeRoutedDialogs, mergeRoutedMessages } from '@/mesh/store/messenger-mapping'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { getAddressFromMatrixId } from '../../helpers'
import type { Dialog, Message } from '../../types'
import type { useMessengerUiStore } from '../messenger-ui-store'

/** Состояния синка Matrix, при которых сервер чатов на связи. */
const SYNC_OK = new Set(['PREPARED', 'SYNCING', 'CATCHUP'])

export interface ActiveMeshRoute {
  /** mesh-диалог маршрута; null — свой узел Reticulum не запущен. */
  meshId: string | null
  route: MeshRoute
  /** Сервер чатов на связи. */
  online: boolean
  /** Отправлять через Reticulum, даже когда сервер на связи. */
  forced: boolean
  /** Сообщение сейчас уйдёт через Reticulum. */
  viaMesh: boolean
}

export function useMeshRoutes(ctx: {
  uiStore: ReturnType<typeof useMessengerUiStore>
  meshChat: ReturnType<typeof useMeshChatStore>
}) {
  const { uiStore, meshChat } = ctx
  const routes = useMeshRoutesStore()
  const rns = useReticulumStore()

  // navigator.onLine — сразу, синк Matrix узнаёт о разрыве позже.
  const browserOnline = ref(typeof navigator === 'undefined' || navigator.onLine !== false)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => (browserOnline.value = true))
    window.addEventListener('offline', () => (browserOnline.value = false))
  }

  const matrixOnline = computed(() => browserOnline.value && SYNC_OK.has(uiStore.syncState))

  /** Чаты, где пользователь выбрал «через Reticulum». */
  const forced = ref<Record<string, boolean>>({})

  function dialogOf(chatId: string): Dialog | null {
    return (
      uiStore.dialogs.find((d) => d.id === chatId) ??
      (uiStore.activeDialog?.id === chatId ? uiStore.activeDialog : null)
    )
  }

  /** Собеседник личного диалога Bastyon и его mesh-маршрут. */
  function routeOf(chatId: string | null): { dialog: Dialog; route: MeshRoute } | null {
    if (!chatId || chatId.startsWith('mesh:')) return null
    const dialog = dialogOf(chatId)
    const partnerId = dialog?.partner.id
    if (!dialog || !partnerId?.startsWith('@')) return null
    const route = routes.routeFor(getAddressFromMatrixId(partnerId))
    return route ? { dialog, route } : null
  }

  function meshIdOf(route: MeshRoute): string | null {
    return rns.address ? directDialogId('lxmf', rns.address, route.binding.dest) : null
  }

  /** mesh-диалог маршрута чата Bastyon (есть ли он уже или нет). */
  function meshIdFor(chatId: string): string | null {
    const r = routeOf(chatId)
    return r ? meshIdOf(r.route) : null
  }

  /** Завести mesh-диалог маршрута (он скрыт в списке) и открыть его историю. */
  async function openRouted(chatId: string): Promise<string | null> {
    const r = routeOf(chatId)
    if (!r || !rns.address) return null
    const meshId = await meshChat.ensureLxmfDialog(
      rns.address,
      r.route.binding.dest,
      r.dialog.partner.name || null
    )
    uiStore.setChatAlias(meshId, chatId)
    await meshChat.openDialog(meshId)
    if (uiStore.isChatOnScreen(chatId)) meshChat.markRead(meshId)
    return meshId
  }

  function state(chatId: string | null): ActiveMeshRoute | null {
    const r = routeOf(chatId)
    if (!r || !chatId) return null
    const meshId = meshIdOf(r.route)
    const isForced = !!forced.value[chatId]
    const canSend = !!meshId && meshChat.canSend(meshId)
    return {
      meshId,
      route: r.route,
      online: matrixOnline.value,
      forced: isForced,
      viaMesh: canSend && (isForced || !matrixOnline.value),
    }
  }

  const active = computed(() => state(uiStore.activeChatId))

  /** mesh-диалог, через который сейчас уйдёт сообщение в чат; null — через Matrix. */
  async function sendRoute(chatId: string): Promise<string | null> {
    await openRouted(chatId)
    const s = state(chatId)
    return s?.viaMesh ? s.meshId : null
  }

  function toggleForced(chatId: string): void {
    forced.value = { ...forced.value, [chatId]: !forced.value[chatId] }
  }

  function messagesOf(chatId: string, matrix: Message[]): Message[] {
    const r = routeOf(chatId)
    const meshId = r && meshIdOf(r.route)
    if (!r || !meshId) return matrix
    return mergeRoutedMessages(matrix, meshChat.messengerMessages(meshId), {
      id: r.dialog.partner.id,
      name: r.dialog.partner.name,
    })
  }

  function dialogsOf(matrix: Dialog[], mesh: Dialog[]): Dialog[] {
    return mergeRoutedDialogs(matrix, mesh, (d) => meshIdFor(d.id))
  }

  /**
   * Сервер чатов недоступен, а у чата есть маршрут: история Matrix не
   * загрузится, пока не вернётся связь, — ждать её незачем.
   */
  function offlineRouted(chatId: string | null): boolean {
    return !matrixOnline.value && !!routeOf(chatId)
  }

  return {
    matrixOnline,
    active,
    routeOf,
    openRouted,
    sendRoute,
    toggleForced,
    messagesOf,
    dialogsOf,
    offlineRouted,
  }
}
