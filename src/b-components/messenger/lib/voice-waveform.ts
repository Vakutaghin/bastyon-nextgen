// Волна голосового. Её кладут в событие (как Forta Chat: `info.waveform` —
// 50 целых 0…1024, MSC3245), и чат рисует её, не скачивая сам звук: раньше
// каждое голосовое при открытии чата скачивалось, расшифровывалось и
// декодировалось целиком ради одной картинки. Звук — только по «Слушать».
// Где волны в событии нет (прежний Bastyon, свои старые голосовые), её
// считают по звуку, когда он уже есть: свой с устройства или скачанный для
// прослушивания.

/** Сколько чисел волны уходит в событие — как у Forta Chat. */
export const WAVEFORM_SAMPLES = 50
/** Шкала целых в событии (MSC3245). */
const WAVEFORM_SCALE = 1024
/** Самый низкий столбик: тишина — точка, а не пусто. */
const MIN_BAR = 0.06

/** Волна с формой: пустая, тишина и ровная линия — не волна, её считают по звуку. */
export function hasWaveformShape(samples: readonly number[] | null | undefined): boolean {
  if (!samples || samples.length < 2) return false
  const max = Math.max(...samples)
  const min = Math.min(...samples)
  return max > 0 && max - min > max * 0.05
}

/**
 * Волна из события, 0…1. Целые (MSC3245, Forta) — до 1024, дробные — уже 0…1;
 * шкала — по всему массиву: целая 1 среди сотен — это 1/1024, а не потолок.
 */
export function waveformFromInfo(info: Record<string, unknown> | undefined): number[] | null {
  const raw = info?.waveform
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 4096) return null
  if (!raw.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return null
  const values = raw as number[]
  const integers = values.some((v) => v > 1)
  const samples = integers ? values.map((v) => Math.min(1, v / WAVEFORM_SCALE)) : values
  return hasWaveformShape(samples) ? samples : null
}

/** Волна для события: самый громкий кусок — 1024. */
export function waveformToInfo(samples: readonly number[]): number[] {
  const max = Math.max(...samples, 0)
  if (max <= 0) return samples.map(() => 0)
  return samples.map((v) => Math.round((v / max) * WAVEFORM_SCALE))
}

/** Столбики для рисунка: `count` средних по кускам, самый высокий — 1. */
export function waveformBars(samples: readonly number[], count: number): number[] {
  if (samples.length === 0 || count <= 0) return []
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * samples.length) / count)
    const end = Math.max(start + 1, Math.floor(((i + 1) * samples.length) / count))
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j] ?? 0
    bars.push(sum / (end - start))
  }
  const max = Math.max(...bars, 0.0001)
  return bars.map((v) => Math.max(MIN_BAR, v / max))
}

/** Звук, разобранный для волны: средняя громкость по кускам и длительность. */
export interface DecodedVoice {
  samples: number[]
  /** Длительность звука, с: у записи MediaRecorder в файле её может не быть. */
  duration: number
}

type OfflineCtor = new (channels: number, length: number, rate: number) => BaseAudioContext

function audioContext(): { ctx: BaseAudioContext; close: () => void } | null {
  const w = window as Window & {
    webkitOfflineAudioContext?: OfflineCtor
    webkitAudioContext?: typeof AudioContext
  }
  // OfflineAudioContext не занимает звуковой выход: живых AudioContext
  // браузер держит немного, а раньше каждое голосовое заводило свой.
  const Offline: OfflineCtor | undefined =
    typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : w.webkitOfflineAudioContext
  if (Offline) return { ctx: new Offline(1, 1, 44100), close: () => {} }
  const Live = typeof AudioContext !== 'undefined' ? AudioContext : w.webkitAudioContext
  if (!Live) return null
  const live = new Live()
  return { ctx: live, close: () => void live.close().catch(() => {}) }
}

async function decode(blob: Blob, count: number): Promise<DecodedVoice | null> {
  const audio = audioContext()
  if (!audio) return null
  try {
    const buffer = await audio.ctx.decodeAudioData(await blob.arrayBuffer())
    const channel = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0)
    const step = Math.floor(channel.length / count)
    if (step === 0) return { samples: [], duration: buffer.duration }
    const samples: number[] = []
    for (let i = 0; i < count; i++) {
      let sum = 0
      for (let j = i * step; j < (i + 1) * step; j++) sum += Math.abs(channel[j] ?? 0)
      samples.push(sum / step)
    }
    return { samples, duration: buffer.duration }
  } finally {
    audio.close()
  }
}

/** Один и тот же Blob (своё голосовое: плеер и отправка) разбираем один раз. */
const decoded = new WeakMap<Blob, Promise<DecodedVoice | null>>()
/** По одному: чат с десятком своих голосовых не декодирует их разом. */
let queue: Promise<unknown> = Promise.resolve()

/** Разобрать звук для волны. Не вышло (формат не знаком движку) — null. */
export function decodeVoice(blob: Blob): Promise<DecodedVoice | null> {
  const known = decoded.get(blob)
  if (known) return known
  const run = queue.then(() => decode(blob, WAVEFORM_SAMPLES).catch(() => null))
  queue = run
  decoded.set(blob, run)
  return run
}

/** Тесты: очередь с чистого листа. */
export function resetVoiceDecodingForTests(): void {
  queue = Promise.resolve()
}
