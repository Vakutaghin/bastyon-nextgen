/**
 * Голосовые LXMF. Sideband и MeshChat ждут Opus в контейнере Ogg: поле AUDIO,
 * режим AM_OPUS_OGG, другие режимы Opus Sideband не проигрывает. MediaRecorder
 * в Chromium и WKWebView пишет Opus в WebM. Здесь WebM перепаковывается в Ogg
 * без перекодирования: пакеты Opus те же, меняется только контейнер.
 */

import type { MeshAttachment } from '@/db/types'

// ─── WebM (EBML) ─────────────────────────────────────────────────────────────

const EBML_TRACK_ENTRY = 0xae
const EBML_TRACK_NUMBER = 0xd7
const EBML_CODEC_ID = 0x86
const EBML_CODEC_PRIVATE = 0x63a2
const EBML_CHANNELS = 0x9f
const EBML_SIMPLE_BLOCK = 0xa3
const EBML_BLOCK = 0xa1

/**
 * Элементы-контейнеры: их содержимое читается подряд, как будто контейнера
 * нет. Так не важен размер, который MediaRecorder у Segment и Cluster пишет
 * «неизвестным».
 */
const CONTAINERS = new Set([
  0x18538067, // Segment
  0x1f43b675, // Cluster
  0x1654ae6b, // Tracks
  EBML_TRACK_ENTRY,
  0xe1, // Audio
  0xa0, // BlockGroup
])

interface Vint {
  value: number
  length: number
  /** Все биты значения — единицы: «размер неизвестен». */
  unknown: boolean
}

/** EBML-число переменной длины; `keepMarker` — для id (они пишутся с маркером). */
function readVint(buf: Uint8Array, pos: number, keepMarker: boolean): Vint | null {
  const first = buf[pos]
  if (first === undefined || first === 0) return null
  let length = 1
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++
  if (length > 8 || pos + length > buf.length) return null
  let value = keepMarker ? first : first & (0xff >> length)
  let allOnes = value === 0xff >> length
  for (let i = 1; i < length; i++) {
    const b = buf[pos + i]!
    value = value * 256 + b
    allOnes &&= b === 0xff
  }
  return { value, length, unknown: !keepMarker && allOnes }
}

interface WebmTrack {
  number: number
  codec: string
  codecPrivate: Uint8Array | null
  channels: number
}

/** Кадры блока с учётом «шнуровки» (несколько кадров в одном блоке). */
function blockFrames(payload: Uint8Array): { track: number; frames: Uint8Array[] } | null {
  const track = readVint(payload, 0, false)
  if (!track) return null
  let pos = track.length + 3 // номер дорожки, 2 байта времени, флаги
  if (pos > payload.length) return null
  const lacing = (payload[pos - 1]! >> 1) & 3
  if (lacing === 0) return { track: track.value, frames: [payload.subarray(pos)] }

  const count = payload[pos++]! + 1
  const sizes: number[] = []
  if (lacing === 1) {
    // Xiph: размеры байтами по 255.
    for (let i = 0; i < count - 1; i++) {
      let size = 0
      let b: number
      do {
        b = payload[pos++] ?? 0
        size += b
      } while (b === 255)
      sizes.push(size)
    }
  } else if (lacing === 3) {
    // EBML: первый размер — число, остальные — разница со знаком.
    const first = readVint(payload, pos, false)
    if (!first) return null
    pos += first.length
    sizes.push(first.value)
    for (let i = 1; i < count - 1; i++) {
      const delta = readVint(payload, pos, false)
      if (!delta) return null
      pos += delta.length
      const bias = 2 ** (7 * delta.length - 1) - 1
      sizes.push(sizes[i - 1]! + delta.value - bias)
    }
  } else {
    // Одинаковые кадры.
    const each = Math.floor((payload.length - pos) / count)
    for (let i = 0; i < count - 1; i++) sizes.push(each)
  }
  const frames: Uint8Array[] = []
  for (const size of sizes) {
    if (size < 0 || pos + size > payload.length) return null
    frames.push(payload.subarray(pos, pos + size))
    pos += size
  }
  frames.push(payload.subarray(pos))
  return { track: track.value, frames }
}

/** Дорожка Opus и её пакеты из WebM; null — не WebM или в нём нет Opus. */
export function readWebmOpus(
  buf: Uint8Array
): { head: Uint8Array | null; channels: number; packets: Uint8Array[] } | null {
  const tracks: WebmTrack[] = []
  const blocks: Array<{ track: number; frames: Uint8Array[] }> = []
  let pos = 0
  while (pos < buf.length) {
    const id = readVint(buf, pos, true)
    const size = id && readVint(buf, pos + id.length, false)
    if (!id || !size) break
    const start = pos + id.length + size.length
    if (CONTAINERS.has(id.value)) {
      if (id.value === EBML_TRACK_ENTRY) {
        tracks.push({ number: 0, codec: '', codecPrivate: null, channels: 1 })
      }
      pos = start
      continue
    }
    const end = size.unknown ? buf.length : Math.min(buf.length, start + size.value)
    const data = buf.subarray(start, end)
    const track = tracks[tracks.length - 1]
    if (id.value === EBML_SIMPLE_BLOCK || id.value === EBML_BLOCK) {
      const block = blockFrames(data)
      if (block) blocks.push(block)
    } else if (track && id.value === EBML_TRACK_NUMBER) {
      track.number = uint(data)
    } else if (track && id.value === EBML_CODEC_ID) {
      track.codec = new TextDecoder().decode(data)
    } else if (track && id.value === EBML_CODEC_PRIVATE) {
      track.codecPrivate = data
    } else if (track && id.value === EBML_CHANNELS) {
      track.channels = uint(data) || 1
    }
    pos = end
  }
  const opus = tracks.find((t) => t.codec === 'A_OPUS')
  if (!opus) return null
  const packets = blocks.filter((b) => b.track === opus.number).flatMap((b) => b.frames)
  if (packets.length === 0) return null
  const head = opus.codecPrivate && isOpusHead(opus.codecPrivate) ? opus.codecPrivate : null
  return { head, channels: opus.channels, packets }
}

function uint(data: Uint8Array): number {
  let v = 0
  for (const b of data) v = v * 256 + b
  return v
}

// ─── Opus и Ogg ──────────────────────────────────────────────────────────────

const OPUS_HEAD = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64] // «OpusHead»
const OPUS_TAGS = [0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73] // «OpusTags»

function isOpusHead(data: Uint8Array): boolean {
  return data.length >= 19 && OPUS_HEAD.every((b, i) => data[i] === b)
}

/** Сколько сэмплов (48 кГц) в пакете Opus — по его первому байту (RFC 6716, 3.1). */
export function opusPacketSamples(packet: Uint8Array): number {
  const toc = packet[0]
  if (toc === undefined) return 0
  const config = toc >> 3
  const frameMs =
    config < 12
      ? [10, 20, 40, 60][config & 3]!
      : config < 16
        ? [10, 20][config & 1]!
        : [2.5, 5, 10, 20][config & 3]!
  const code = toc & 3
  const frames = code === 0 ? 1 : code === 3 ? (packet[1] ?? 0) & 0x3f : 2
  return Math.round(frames * frameMs * 48)
}

/** OpusHead по умолчанию (RFC 7845, 5.1): pre-skip 312, как у libopus. */
function defaultOpusHead(channels: number): Uint8Array {
  const head = new Uint8Array(19)
  head.set(OPUS_HEAD)
  const view = new DataView(head.buffer)
  head[8] = 1 // версия
  head[9] = Math.min(Math.max(channels, 1), 2)
  view.setUint16(10, 312, true)
  view.setUint32(12, 48000, true)
  return head
}

function opusTags(vendor: string): Uint8Array {
  const v = new TextEncoder().encode(vendor)
  const out = new Uint8Array(8 + 4 + v.length + 4)
  out.set(OPUS_TAGS)
  new DataView(out.buffer).setUint32(8, v.length, true)
  out.set(v, 12)
  return out
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1
    table[i] = r >>> 0
  }
  return table
})()

/** CRC страницы Ogg: полином 0x04C11DB7, без отражения, начальное 0. */
export function oggCrc(data: Uint8Array): number {
  let crc = 0
  for (const b of data) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ b) & 0xff]!) >>> 0
  return crc
}

const OGG_BOS = 0x02
const OGG_EOS = 0x04

function oggPage(
  packets: Uint8Array[],
  flags: number,
  granule: number,
  serial: number,
  sequence: number
): Uint8Array {
  const lacing: number[] = []
  for (const p of packets) {
    let left = p.length
    while (left >= 255) {
      lacing.push(255)
      left -= 255
    }
    lacing.push(left)
  }
  const body = packets.reduce((n, p) => n + p.length, 0)
  const page = new Uint8Array(27 + lacing.length + body)
  const view = new DataView(page.buffer)
  page.set([0x4f, 0x67, 0x67, 0x53]) // «OggS»
  page[5] = flags
  view.setUint32(6, granule % 2 ** 32, true)
  view.setUint32(10, Math.floor(granule / 2 ** 32), true)
  view.setUint32(14, serial, true)
  view.setUint32(18, sequence, true)
  page[26] = lacing.length
  page.set(lacing, 27)
  let pos = 27 + lacing.length
  for (const p of packets) {
    page.set(p, pos)
    pos += p.length
  }
  view.setUint32(22, oggCrc(page), true)
  return page
}

/** Страница аудио — около секунды звука и не больше 255 сегментов. */
const PAGE_SAMPLES = 48_000
const PAGE_SEGMENTS = 255

/** Пакеты Opus → поток Ogg Opus (RFC 7845). */
export function oggOpus(
  packets: Uint8Array[],
  options: { head?: Uint8Array | null; channels?: number; serial?: number } = {}
): Uint8Array {
  const serial = options.serial ?? crypto.getRandomValues(new Uint32Array(1))[0]!
  const head = options.head ?? defaultOpusHead(options.channels ?? 1)
  const pages = [
    oggPage([head], OGG_BOS, 0, serial, 0),
    oggPage([opusTags('Bastyon')], 0, 0, serial, 1),
  ]
  let granule = 0
  let batch: Uint8Array[] = []
  let segments = 0
  let batchSamples = 0
  const flush = (last: boolean): void => {
    pages.push(oggPage(batch, last ? OGG_EOS : 0, granule, serial, pages.length))
    batch = []
    segments = 0
    batchSamples = 0
  }
  packets.forEach((p, i) => {
    const need = Math.floor(p.length / 255) + 1
    if (batch.length > 0 && segments + need > PAGE_SEGMENTS) flush(false)
    batch.push(p)
    segments += need
    const samples = opusPacketSamples(p)
    granule += samples
    batchSamples += samples
    const last = i === packets.length - 1
    if (last || batchSamples >= PAGE_SAMPLES) flush(last)
  })
  const out = new Uint8Array(pages.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of pages) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

export function isOggOpus(buf: Uint8Array): boolean {
  return (
    buf.length > 36 &&
    buf[0] === 0x4f &&
    buf[1] === 0x67 &&
    buf[2] === 0x67 &&
    buf[3] === 0x53 &&
    isOpusHead(buf.subarray(28))
  )
}

// ─── Запись → вложение ───────────────────────────────────────────────────────

/** Что писать MediaRecorder-у: Ogg Opus, если умеет (Firefox), иначе WebM Opus. */
export const VOICE_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus']

/** 16 кбит/с: речь разборчива, минута — около 120 КБ (WebKit битрейт не слушает). */
export const VOICE_BITRATE = 16_000

/** Запись MediaRecorder → голосовое LXMF (Ogg Opus). null — не Opus. */
export function voiceAttachment(recorded: Uint8Array): MeshAttachment | null {
  let data: Uint8Array | null = null
  if (isOggOpus(recorded)) data = recorded
  else {
    const webm = readWebmOpus(recorded)
    if (webm) data = oggOpus(webm.packets, { head: webm.head, channels: webm.channels })
  }
  return data ? { kind: 'audio', name: 'voice.ogg', mime: 'audio/ogg', data } : null
}

let oggPlayable: boolean | null = null

/** Проиграет ли WebView Ogg Opus: иначе голосовое показывается файлом. */
export function canPlayOggOpus(): boolean {
  if (oggPlayable === null) {
    try {
      oggPlayable = document.createElement('audio').canPlayType('audio/ogg; codecs=opus') !== ''
    } catch {
      oggPlayable = false
    }
  }
  return oggPlayable
}
