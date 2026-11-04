/**
 * Декодирование аудио-blob в waveform-семплы для отрисовки PIXI'ем.
 *
 * Алгоритм: WebAudio decodeAudioData → берём канал 0 → делим на barCount
 * сегментов → peak в каждом (max-pooling). Финальная нормализация — power(0.8)
 * для визуального сглаживания. Заодно отдаём длительность звука: у записи
 * MediaRecorder в файле её может не быть, и `<audio>` тогда сообщает Infinity.
 *
 * См. CODE_AUDIT.md §1.
 */
import { ref, type Ref } from 'vue'

const SAMPLE_SMOOTHING_POWER = 0.8

export interface DecodedWave {
  bars: number[]
  /** Длительность звука, с. */
  duration: number
}

export interface AudioDecoding {
  decodeWaveform: (blob: Blob, barCount: number) => Promise<DecodedWave>
  /** Закрыть AudioContext (вызывать в onBeforeUnmount). */
  close: () => Promise<void>
  /** Текущий context — наружу нужен ровно для cleanup-проверки в тестах. */
  audioContext: Ref<AudioContext | null>
}

export function useAudioDecoding(): AudioDecoding {
  const audioContext = ref<AudioContext | null>(null)

  async function decodeWaveform(blob: Blob, barCount: number): Promise<DecodedWave> {
    if (!audioContext.value) {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      audioContext.value = new Ctx()
    }
    const buffer = await blob.arrayBuffer()
    const decoded = await audioContext.value.decodeAudioData(buffer)
    const channelData =
      decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : new Float32Array(0)
    const samples = channelData.length
    const samplesPerBar = Math.max(1, Math.floor(samples / barCount))
    const result: number[] = []
    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar
      const end = Math.min(samples, start + samplesPerBar)
      let peak = 0
      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j] ?? 0)
        if (v > peak) peak = v
      }
      // Степень 0.8 чуть сглаживает экстремумы — визуально приятнее.
      result.push(Math.pow(peak, SAMPLE_SMOOTHING_POWER))
    }
    return { bars: result, duration: decoded.duration }
  }

  async function close(): Promise<void> {
    try {
      await audioContext.value?.close()
    } catch {
      // ignore
    }
    audioContext.value = null
  }

  return { decodeWaveform, close, audioContext }
}
