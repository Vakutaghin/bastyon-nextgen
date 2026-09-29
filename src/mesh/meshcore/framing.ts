/**
 * Кадры companion-протокола MeshCore поверх транспорта.
 *
 * - USB-serial и TCP — поток: приложение шлёт `'<'` + длина uint16 LE + кадр,
 *   радио отвечает `'>'` + длина + кадр (src/helpers/ArduinoSerialInterface.cpp).
 * - BLE (Nordic UART) — кадр равен одной записи или одному уведомлению, без
 *   заголовка.
 *
 * Протокол выше работает с `FrameLink` и не знает, какой транспорт под ним.
 */

import { concat, u16le } from '../bytes'
import type { ByteLink, CloseReason, GattLink, Unsubscribe } from '../radio/types'
import { MAX_FRAME_SIZE, NUS_RX, NUS_TX } from './constants'

export const APP_TO_RADIO = 0x3c // '<'
export const RADIO_TO_APP = 0x3e // '>'

export interface FrameLink {
  readonly kind: 'serial' | 'tcp' | 'ble'
  readonly label: string
  send(frame: Uint8Array): Promise<void>
  onFrame(cb: (frame: Uint8Array) => void): Unsubscribe
  onClose(cb: (reason: CloseReason) => void): Unsubscribe
  close(): Promise<void>
}

/** Кадр для потока: маркер направления, длина LE, данные. */
export function encodeStreamFrame(frame: Uint8Array, marker = APP_TO_RADIO): Uint8Array {
  if (frame.length === 0 || frame.length > MAX_FRAME_SIZE) {
    throw new RangeError(`frame size ${frame.length} out of range`)
  }
  return concat(new Uint8Array([marker]), u16le(frame.length), frame)
}

/**
 * Режет поток на кадры. Байты вне кадра (загрузочный вывод платы, обрыв на
 * середине кадра) пропускаются до следующего маркера; длина больше
 * MAX_FRAME_SIZE или ноль — не кадр, ищем маркер дальше.
 */
export class StreamDeframer {
  private buf: Uint8Array = new Uint8Array(0)

  constructor(private readonly marker = RADIO_TO_APP) {}

  push(chunk: Uint8Array): Uint8Array[] {
    this.buf = this.buf.length === 0 ? chunk.slice() : concat(this.buf, chunk)
    const frames: Uint8Array[] = []
    let at = 0
    while (at < this.buf.length) {
      if (this.buf[at] !== this.marker) {
        at++
        continue
      }
      if (at + 3 > this.buf.length) break // заголовок ещё не дошёл
      const len = this.buf[at + 1]! | (this.buf[at + 2]! << 8)
      if (len === 0 || len > MAX_FRAME_SIZE) {
        at++ // ложный маркер: ищем следующий
        continue
      }
      if (at + 3 + len > this.buf.length) break // тело ещё не дошло
      frames.push(this.buf.slice(at + 3, at + 3 + len))
      at += 3 + len
    }
    this.buf = this.buf.slice(at)
    return frames
  }
}

export function frameLinkFromStream(link: ByteLink): FrameLink {
  const deframer = new StreamDeframer(RADIO_TO_APP)
  const frameCbs = new Set<(f: Uint8Array) => void>()
  link.onData((chunk) => {
    for (const frame of deframer.push(chunk)) for (const cb of [...frameCbs]) cb(frame)
  })
  return {
    kind: link.kind,
    label: link.label,
    send: (frame) => link.write(encodeStreamFrame(frame, APP_TO_RADIO)),
    onFrame(cb) {
      frameCbs.add(cb)
      return () => frameCbs.delete(cb)
    },
    onClose: (cb) => link.onClose(cb),
    close: () => link.close(),
  }
}

/** BLE: подписка на TX до того, как протокол начнёт слать команды. */
export async function frameLinkFromGatt(link: GattLink): Promise<FrameLink> {
  const frameCbs = new Set<(f: Uint8Array) => void>()
  await link.subscribe(NUS_TX, (value) => {
    if (value.length === 0) return
    for (const cb of [...frameCbs]) cb(value)
  })
  return {
    kind: 'ble',
    label: link.label,
    send: (frame) => link.write(NUS_RX, frame, true),
    onFrame(cb) {
      frameCbs.add(cb)
      return () => frameCbs.delete(cb)
    },
    onClose: (cb) => link.onClose(cb),
    close: () => link.close(),
  }
}
