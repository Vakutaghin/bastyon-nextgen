/**
 * «Записывает голосовое…» — в обе стороны.
 *
 * - {@link useRecordingBroadcast}: пока вы записываете, собеседники получают
 *   to-device сигнал (если в настройках не выключено); сигнал повторяется,
 *   а по окончании записи — «перестал».
 * - {@link useRecordingIndicator}: кто в открытом чате сейчас записывает.
 *   Сигнал без повтора гаснет сам — запись могла оборваться.
 *
 * Состояние «кто записывает» — в чистых функциях {@link applyRecordingSignal}
 * и {@link activeRecorders}: тестируются без Matrix.
 */

import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { matrixService } from '../../services/matrix-service'
import { useMessengerProfileCache } from '../../store/messenger-profile-cache'
import { chatUserName } from '../../helpers'
import {
  RECORDING_EVENT,
  RECORDING_REFRESH_MS,
  RECORDING_TTL_MS,
  parseRecordingSignal,
} from '../../lib/chat-privacy'

export function useRecordingBroadcast(
  roomId: Ref<string | null>,
  isRecording: Ref<boolean>,
  allowed: () => boolean
) {
  /** Комната, которой сказали «записываю»: ей же и скажем «перестал». */
  let sentTo: string | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
    if (sentTo) void matrixService.sendRecording(sentTo, false)
    sentTo = null
  }

  function sync(): void {
    const rid = roomId.value
    const want = isRecording.value && allowed() && !!rid && rid.startsWith('!')
    if (!want) return stop()
    if (sentTo === rid) return
    stop()
    sentTo = rid
    void matrixService.sendRecording(rid, true)
    timer = setInterval(() => {
      if (sentTo) void matrixService.sendRecording(sentTo, true)
    }, RECORDING_REFRESH_MS)
  }

  watch([roomId, isRecording, allowed], sync)
  onBeforeUnmount(stop)
}

/** userId → когда отметка погаснет (мс). По комнатам. */
export type RecordersByRoom = ReadonlyMap<string, ReadonlyMap<string, number>>

export function applyRecordingSignal(
  current: RecordersByRoom,
  signal: { roomId: string; sender: string; recording: boolean },
  now: number
): Map<string, Map<string, number>> {
  const next = new Map([...current].map(([room, users]) => [room, new Map(users)]))
  const users = next.get(signal.roomId) ?? new Map<string, number>()
  if (signal.recording) users.set(signal.sender, now + RECORDING_TTL_MS)
  else users.delete(signal.sender)
  if (users.size) next.set(signal.roomId, users)
  else next.delete(signal.roomId)
  return next
}

/** Кто в комнате записывает прямо сейчас (отметки, что не погасли). */
export function activeRecorders(
  map: RecordersByRoom,
  roomId: string | null,
  now: number
): string[] {
  if (!roomId) return []
  return [...(map.get(roomId) ?? [])].filter(([, until]) => until > now).map(([id]) => id)
}

interface ToDevicePayload {
  message?: { type?: string; sender?: string; content?: unknown }
}

const RECEIVED_TO_DEVICE = 'receivedToDeviceMessage'

export function useRecordingIndicator(activeRoomId: Ref<string | null>) {
  const recorders = ref<Map<string, Map<string, number>>>(new Map())
  /** Тик, чтобы погасшие отметки исчезали без новых сигналов. */
  const now = ref(Date.now())
  let tick: ReturnType<typeof setInterval> | null = null
  const profileCache = useMessengerProfileCache()

  function onToDevice(payload: ToDevicePayload): void {
    const message = payload?.message
    if (message?.type !== RECORDING_EVENT || typeof message.sender !== 'string') return
    const signal = parseRecordingSignal(message.content)
    if (!signal) return
    const client = matrixService.getClient()
    if (message.sender === client?.getUserId?.()) return
    // Сигнал считаем, только если отправитель и правда в этой комнате.
    const member = client?.getRoom?.(signal.roomId)?.getMember?.(message.sender)
    if (member?.membership !== 'join') return
    now.value = Date.now()
    recorders.value = applyRecordingSignal(
      recorders.value,
      { ...signal, sender: message.sender },
      now.value
    )
  }

  const ids = computed<string[]>(() =>
    activeRecorders(recorders.value, activeRoomId.value, now.value)
  )

  /** Имя первого, кто записывает, — для текста под перепиской; null — никто. */
  const recordingName = computed<string | null>(() => {
    const first = ids.value[0]
    if (!first) return null
    const rid = activeRoomId.value
    const member = rid ? matrixService.getClient()?.getRoom?.(rid)?.getMember?.(first) : null
    return chatUserName(first, profileCache.userProfiles, member?.name || member?.rawDisplayName)
  })

  onMounted(() => {
    matrixService.getClient()?.on?.(RECEIVED_TO_DEVICE, onToDevice)
    tick = setInterval(() => {
      if (recorders.value.size) now.value = Date.now()
    }, 1000)
  })
  onBeforeUnmount(() => {
    matrixService.getClient()?.off?.(RECEIVED_TO_DEVICE, onToDevice)
    if (tick) clearInterval(tick)
  })

  return { recordingName }
}
