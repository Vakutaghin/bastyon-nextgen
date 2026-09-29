/**
 * «Один диалог — несколько маршрутов» (этап 8 плана mesh-сетей). У человека,
 * который поделился адресами в mesh-сетях (проверенные записи связки,
 * src/mesh/binding.ts), диалог Bastyon продолжается через mesh-сеть, когда
 * сервер чатов недоступен, — или всегда, если так выбрать в чате.
 *
 * - Маршрутов у человека до трёх: Reticulum, MeshCore, Meshtastic. Сообщение
 *   уходит первым доступным — Reticulum (сквозное шифрование), потом радио.
 * - Переписка через все его mesh-маршруты показывается в том же чате, по
 *   времени; отдельные mesh-диалоги с ним в списке прячутся, свежее и
 *   непрочитанное — в диалоге Bastyon.
 * - История через mesh хранится локально, как у всех mesh-диалогов: на
 *   другом устройстве её нет, в Matrix она не попадает.
 */

import { computed, ref, watch } from 'vue'

import type { MeshNet } from '@/mesh/binding'
import { dialogKeyOf, directDialogId, nodeKey, parseMeshDialogId } from '@/mesh/ids'
import type { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshRoutesStore, type MeshRoute } from '@/mesh/store/mesh-routes-store'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { mergeRoutedDialogs, mergeRoutedMessages } from '@/mesh/store/messenger-mapping'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { getAddressFromMatrixId } from '../../helpers'
import type { Dialog, Message } from '../../types'
import type { useMessengerUiStore } from '../messenger-ui-store'

/** Состояния синка Matrix, при которых сервер чатов на связи. */
const SYNC_OK = new Set(['PREPARED', 'SYNCING', 'CATCHUP'])

export interface ActiveMeshRoute {
  /** Сети, в которых у собеседника есть маршрут, по порядку предпочтения. */
  nets: MeshNet[]
  /** Сеть, через которую уйдёт сообщение, если уходит через mesh. */
  net: MeshNet | null
  /** mesh-диалог, через который уйдёт сообщение; null — ни одна сеть сейчас не готова. */
  meshId: string | null
  /** Сервер чатов на связи. */
  online: boolean
  /** Отправлять через mesh, даже когда сервер на связи. */
  forced: boolean
  /** Сообщение сейчас уйдёт через mesh. */
  viaMesh: boolean
}

export function useMeshRoutes(ctx: {
  uiStore: ReturnType<typeof useMessengerUiStore>
  meshChat: ReturnType<typeof useMeshChatStore>
}) {
  const { uiStore, meshChat } = ctx
  const routes = useMeshRoutesStore()
  const rns = useReticulumStore()
  const meshcore = useMeshConnectionStore()
  const meshtastic = useMeshtasticConnectionStore()

  // navigator.onLine — сразу, синк Matrix узнаёт о разрыве позже.
  const browserOnline = ref(typeof navigator === 'undefined' || navigator.onLine !== false)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => (browserOnline.value = true))
    window.addEventListener('offline', () => (browserOnline.value = false))
  }

  const matrixOnline = computed(() => browserOnline.value && SYNC_OK.has(uiStore.syncState))

  /** Чаты, где пользователь выбрал «через mesh». */
  const forced = ref<Record<string, boolean>>({})

  // Радио подключилось — контакты и ключи собеседников по маршрутам на него.
  watch(
    () => [meshcore.status, meshtastic.status],
    ([mc, mt], previous) => {
      if (
        (mc === 'connected' && previous?.[0] !== 'connected') ||
        (mt === 'connected' && previous?.[1] !== 'connected')
      ) {
        routes.teachRadios()
      }
    }
  )

  function dialogOf(chatId: string): Dialog | null {
    return (
      uiStore.dialogs.find((d) => d.id === chatId) ??
      (uiStore.activeDialog?.id === chatId ? uiStore.activeDialog : null)
    )
  }

  /** Собеседник личного диалога Bastyon и его mesh-маршруты. */
  function routeOf(chatId: string | null): { dialog: Dialog; routes: MeshRoute[] } | null {
    if (!chatId || chatId.startsWith('mesh:')) return null
    const dialog = dialogOf(chatId)
    const partnerId = dialog?.partner.id
    if (!dialog || !partnerId?.startsWith('@')) return null
    const list = routes.routesFor(getAddressFromMatrixId(partnerId))
    return list.length > 0 ? { dialog, routes: list } : null
  }

  /** mesh-диалог маршрута на сейчас подключённой сети; null — сети нет. */
  function liveMeshId(route: MeshRoute): string | null {
    const { net, dest } = route.binding
    if (net === 'lxmf') return rns.address ? directDialogId('lxmf', rns.address, dest) : null
    if (net === 'meshcore') {
      const self = meshcore.self?.publicKey
      return self ? directDialogId('meshcore', self, dest) : null
    }
    const self = meshtastic.self?.nodeNum
    return self !== undefined ? directDialogId('meshtastic', nodeKey(self), dest) : null
  }

  /**
   * Все mesh-диалоги с человеком по его маршрутам — с любым своим узлом
   * (радио сегодня одно, вчера другое), в том числе отключённым сейчас.
   */
  function historyIds(list: MeshRoute[]): string[] {
    const wanted = new Set(
      list.map((r) => `${r.binding.net}|${dialogKeyOf(r.binding.net, r.binding.dest)}`)
    )
    return meshChat.dialogs
      .map((d) => d.id)
      .filter((id) => {
        const p = parseMeshDialogId(id)
        return !!p && p.kind === 'direct' && wanted.has(`${p.network}|${p.key}`)
      })
  }

  /** Завести mesh-диалоги маршрутов на подключённых сетях (они скрыты в списке). */
  async function ensureDialogs(chatId: string): Promise<void> {
    const r = routeOf(chatId)
    if (!r) return
    const name = r.dialog.partner.name || null
    for (const route of r.routes) {
      const { net, dest, key } = route.binding
      if (net === 'lxmf' && rns.address) {
        await meshChat.ensureLxmfDialog(rns.address, dest, name)
      } else if (net === 'meshcore' && meshcore.self && meshcore.session) {
        const contact = meshcore.session.contacts.get(dest)
        if (contact) await meshChat.ensureDirectDialog(meshcore.self.publicKey, contact)
      } else if (net === 'meshtastic' && meshtastic.self) {
        await meshChat.ensureMeshtasticDirectDialog(meshtastic.self.nodeNum, {
          num: parseInt(dest, 16) >>> 0,
          name: name ?? dest,
          publicKey: key,
        })
      }
    }
  }

  /** Открыть историю маршрутов в чате Bastyon (переписка с ним — в этой ленте). */
  async function openRouted(chatId: string): Promise<void> {
    const r = routeOf(chatId)
    if (!r) return
    await ensureDialogs(chatId)
    for (const id of historyIds(r.routes)) {
      uiStore.setChatAlias(id, chatId)
      await meshChat.openDialog(id)
      if (uiStore.isChatOnScreen(chatId)) meshChat.markRead(id)
    }
  }

  function state(chatId: string | null): ActiveMeshRoute | null {
    const r = routeOf(chatId)
    if (!r || !chatId) return null
    const isForced = !!forced.value[chatId]
    const ready = r.routes.find((route) => {
      const id = liveMeshId(route)
      return !!id && meshChat.canSend(id)
    })
    const meshId = ready ? liveMeshId(ready) : null
    return {
      nets: r.routes.map((route) => route.binding.net),
      net: ready?.binding.net ?? null,
      meshId,
      online: matrixOnline.value,
      forced: isForced,
      viaMesh: !!meshId && (isForced || !matrixOnline.value),
    }
  }

  const active = computed(() => state(uiStore.activeChatId))

  /** mesh-диалог, через который сейчас уйдёт сообщение в чат; null — через Matrix. */
  async function sendRoute(chatId: string): Promise<string | null> {
    await ensureDialogs(chatId)
    const s = state(chatId)
    return s?.viaMesh ? s.meshId : null
  }

  function toggleForced(chatId: string): void {
    forced.value = { ...forced.value, [chatId]: !forced.value[chatId] }
  }

  function messagesOf(chatId: string, matrix: Message[]): Message[] {
    const r = routeOf(chatId)
    if (!r) return matrix
    const mesh = historyIds(r.routes).flatMap((id) => meshChat.messengerMessages(id))
    return mergeRoutedMessages(matrix, mesh, {
      id: r.dialog.partner.id,
      name: r.dialog.partner.name,
    })
  }

  function dialogsOf(matrix: Dialog[], mesh: Dialog[]): Dialog[] {
    return mergeRoutedDialogs(matrix, mesh, (d) => {
      const r = routeOf(d.id)
      return r ? historyIds(r.routes) : []
    })
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
