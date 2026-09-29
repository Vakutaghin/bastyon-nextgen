/**
 * Голосовое в чате LXMF: запись MediaRecorder → Ogg Opus (src/mesh/voice.ts),
 * как у Sideband. Кнопка: первое нажатие — запись, второе — отправить,
 * «✕» — отменить. Запись дольше MAX_SECONDS останавливается и уходит сама.
 */

import { computed, onBeforeUnmount, ref } from 'vue'
import type { MeshAttachment } from '@/db/types'
import { VOICE_BITRATE, VOICE_TYPES, voiceAttachment } from '@/mesh/voice'

/** Две минуты: около 240 КБ даже у WebKit, в предел сообщения LXMF влезает. */
export const MAX_SECONDS = 120

export type MeshVoiceError = 'unsupported' | 'not_opus' | { mic: unknown }

function supportedType(): string | null {
  const MR = (window as Window & { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  return VOICE_TYPES.find((t) => MR?.isTypeSupported?.(t)) ?? null
}

export function useMeshVoice(opts: {
  onRecorded: (voice: MeshAttachment) => void
  onError: (e: MeshVoiceError) => void
}) {
  const recording = ref(false)
  const seconds = ref(0)
  const available = computed(() => !!navigator.mediaDevices?.getUserMedia && !!supportedType())

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0
  let send = false

  function release(): void {
    if (timer) clearInterval(timer)
    timer = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    recorder = null
    recording.value = false
  }

  async function finish(type: string): Promise<void> {
    const data = new Uint8Array(await new Blob(chunks, { type }).arrayBuffer())
    chunks = []
    const voice = voiceAttachment(data)
    if (voice) opts.onRecorded(voice)
    else opts.onError('not_opus')
  }

  async function start(): Promise<void> {
    if (recording.value) return
    const type = supportedType()
    if (!type) {
      opts.onError('unsupported')
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch (e) {
      opts.onError({ mic: e })
      return
    }
    chunks = []
    send = false
    try {
      const mr = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: VOICE_BITRATE })
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data)
      }
      mr.onstop = () => {
        const deliver = send
        release()
        if (deliver) void finish(type)
        else chunks = []
      }
      mr.start()
      recorder = mr
    } catch (e) {
      console.warn('[mesh voice] recorder failed:', e)
      release()
      opts.onError('unsupported')
      return
    }
    startedAt = Date.now()
    seconds.value = 0
    recording.value = true
    timer = setInterval(() => {
      seconds.value = Math.floor((Date.now() - startedAt) / 1000)
      if (seconds.value >= MAX_SECONDS) stop()
    }, 250)
  }

  /** Остановить и отправить. */
  function stop(): void {
    if (!recorder || recorder.state === 'inactive') return
    send = true
    recorder.stop()
  }

  function cancel(): void {
    if (!recorder || recorder.state === 'inactive') {
      release()
      return
    }
    send = false
    recorder.stop()
  }

  onBeforeUnmount(cancel)

  return { recording, seconds, available, start, stop, cancel }
}
