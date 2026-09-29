// Голосовые LXMF: запись MediaRecorder (WebM) перепаковывается в Ogg Opus,
// который ждут Sideband и MeshChat. Фикстуры — настоящие записи: Chromium и
// WKWebView (macOS 15), 2 с тона 440 Гц, `audio/webm;codecs=opus`.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  isOggOpus,
  oggCrc,
  oggOpus,
  opusPacketSamples,
  readWebmOpus,
  voiceAttachment,
} from './voice'

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, 'testdata', name)))

interface OggPage {
  flags: number
  granule: number
  serial: number
  sequence: number
  packets: Uint8Array[]
  crcOk: boolean
}

/** Разбор Ogg для проверки: страницы, CRC, пакеты (пакеты не переходят страницу). */
function readOgg(buf: Uint8Array): OggPage[] {
  const pages: OggPage[] = []
  let pos = 0
  while (pos < buf.length) {
    const view = new DataView(buf.buffer, buf.byteOffset + pos)
    expect(String.fromCharCode(...buf.subarray(pos, pos + 4))).toBe('OggS')
    const count = buf[pos + 26]!
    const lacing = buf.subarray(pos + 27, pos + 27 + count)
    const size = 27 + count + lacing.reduce((n, l) => n + l, 0)
    const page = buf.slice(pos, pos + size)
    const stored = new DataView(page.buffer).getUint32(22, true)
    page.fill(0, 22, 26)
    const packets: Uint8Array[] = []
    let at = pos + 27 + count
    let len = 0
    for (const l of lacing) {
      len += l
      if (l < 255) {
        packets.push(buf.subarray(at, at + len))
        at += len
        len = 0
      }
    }
    pages.push({
      flags: buf[pos + 5]!,
      granule: view.getUint32(6, true) + view.getUint32(10, true) * 2 ** 32,
      serial: view.getUint32(14, true),
      sequence: view.getUint32(18, true),
      packets,
      crcOk: oggCrc(page) === stored,
    })
    pos += size
  }
  return pages
}

describe('Ogg Opus for LXMF voice', () => {
  it('reads the frame duration of an Opus packet', () => {
    expect(opusPacketSamples(new Uint8Array([0xfc]))).toBe(960) // CELT 20 мс
    expect(opusPacketSamples(new Uint8Array([0x78]))).toBe(960) // SILK 20 мс (config 15)
    expect(opusPacketSamples(new Uint8Array([0x1b, 0x03]))).toBe(8640) // SILK 60 мс × 3
    expect(opusPacketSamples(new Uint8Array([0x81]))).toBe(240) // CELT 2,5 мс × 2
    expect(opusPacketSamples(new Uint8Array())).toBe(0)
  })

  for (const name of ['voice-chrome.webm', 'voice-webkit.webm']) {
    it(`repacks a real MediaRecorder recording: ${name}`, () => {
      const webm = readWebmOpus(fixture(name))!
      expect(webm.packets.length).toBeGreaterThan(20)
      expect(webm.head).not.toBeNull()
      const samples = webm.packets.reduce((n, p) => n + opusPacketSamples(p), 0)
      // Две секунды записи (плюс-минус кадр на краях).
      expect(samples / 48000).toBeGreaterThan(1.7)
      expect(samples / 48000).toBeLessThan(2.3)

      const ogg = oggOpus(webm.packets, { head: webm.head, serial: 7 })
      expect(isOggOpus(ogg)).toBe(true)
      const pages = readOgg(ogg)
      expect(pages.every((p) => p.crcOk && p.serial === 7)).toBe(true)
      expect(pages.map((p) => p.sequence)).toEqual(pages.map((_, i) => i))
      expect(pages[0]!.flags).toBe(0x02)
      expect(pages[0]!.packets[0]).toEqual(webm.head)
      expect(String.fromCharCode(...pages[1]!.packets[0]!.subarray(0, 8))).toBe('OpusTags')
      expect(pages[pages.length - 1]!.flags).toBe(0x04)
      // Пакеты — те же, по порядку; позиция последней страницы — все сэмплы.
      expect(pages.slice(2).flatMap((p) => p.packets)).toEqual(webm.packets)
      const granules = pages.map((p) => p.granule)
      expect(granules).toEqual([...granules].sort((a, b) => a - b))
      expect(granules[granules.length - 1]).toBe(samples)

      const voice = voiceAttachment(fixture(name))!
      expect(voice).toMatchObject({ kind: 'audio', name: 'voice.ogg', mime: 'audio/ogg' })
      expect(isOggOpus(voice.data)).toBe(true)
    })
  }

  it('keeps an Ogg Opus recording as it is and refuses what is not Opus', () => {
    const ogg = oggOpus([new Uint8Array([0xfc, 1, 2, 3])], { channels: 1, serial: 1 })
    expect(voiceAttachment(ogg)!.data).toBe(ogg)
    expect(voiceAttachment(new TextEncoder().encode('RIFF....WAVE'))).toBeNull()
  })

  it('splits laced blocks (Xiph and EBML lacing)', () => {
    // Минимальный WebM: дорожка 1 A_OPUS и два блока с «шнуровкой» по 3 кадра.
    const el = (id: number[], data: number[]): number[] => [...id, 0x80 | data.length, ...data]
    const opus = [0x41, 0x5f, 0x4f, 0x50, 0x55, 0x53] // «A_OPUS»
    const track = el([0xae], [...el([0xd7], [1]), ...el([0x86], opus)])
    const frames = [
      [0xfc, 1],
      [0xfc, 2, 2],
      [0xfc, 3, 3, 3],
    ]
    const xiph = el([0xa3], [0x81, 0, 0, 0x02, 2, 2, 3, ...frames.flat()])
    // EBML: первый размер 2, затем +1 (0xBF + 1 = 0xC0 → смещение 63).
    const ebml = el([0xa3], [0x81, 0, 0, 0x06, 2, 0x82, 0xc0, ...frames.flat()])
    const buf = new Uint8Array([
      ...[0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ...[0x16, 0x54, 0xae, 0x6b, 0x80 | track.length, ...track],
      ...[0x1f, 0x43, 0xb6, 0x75, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ...xiph,
      ...ebml,
    ])
    const webm = readWebmOpus(buf)!
    expect(webm.head).toBeNull()
    expect(webm.packets.map((p) => [...p])).toEqual([...frames, ...frames])
  })
})
