/**
 * Пакеты клиентского API Meshtastic поверх транспорта.
 *
 * - USB-serial и TCP — поток: `0x94 0xC3`, длина uint16 BE, protobuf
 *   (src/mesh/StreamAPI.cpp). По serial между кадрами идёт текстовый
 *   отладочный вывод платы — его строки отдаются отдельно, а не теряются
 *   молча.
 * - BLE — без заголовка: ToRadio пишется в характеристику toRadio, FromRadio
 *   читается из fromRadio по одному, пока не придёт пустое значение.
 *   Уведомление fromNum значит «есть что читать».
 *
 * Выше лежит `PacketLink`: протокол не знает, какой транспорт под ним.
 */

import { concat } from '../bytes'
import type { ByteLink, CloseReason, GattLink, Unsubscribe } from '../radio/types'
import {
  BLE_FROM_NUM,
  BLE_FROM_RADIO,
  BLE_TO_RADIO,
  MAX_PACKET_SIZE,
  START1,
  START2,
} from './constants'

export interface PacketLink {
  readonly kind: 'serial' | 'tcp' | 'ble'
  readonly label: string
  /** Отправить ToRadio (байты protobuf). */
  send(packet: Uint8Array): Promise<void>
  /** FromRadio (байты protobuf) по одному. */
  onPacket(cb: (packet: Uint8Array) => void): Unsubscribe
  /** Текст платы вне кадров (serial). */
  onText(cb: (line: string) => void): Unsubscribe
  onClose(cb: (reason: CloseReason) => void): Unsubscribe
  /**
   * Разбудить радио перед первым пакетом. Serial-консоль прошивки ждёт
   * серию START2, чтобы переключиться в режим API.
   */
  wake(): Promise<void>
  close(): Promise<void>
}

/** Кадр для потока: START1 START2 длина BE, protobuf. */
export function encodeStreamPacket(packet: Uint8Array): Uint8Array {
  if (packet.length > MAX_PACKET_SIZE) {
    throw new RangeError(`packet size ${packet.length} out of range`)
  }
  return concat(new Uint8Array([START1, START2, packet.length >> 8, packet.length & 0xff]), packet)
}

/**
 * Режет поток на пакеты. Всё, что не кадр, считается текстом платы и
 * отдаётся строками. Длина больше MAX_PACKET_SIZE — не кадр (совпадение
 * байт в тексте), ищем дальше.
 */
export class StreamDeframer {
  private buf: Uint8Array = new Uint8Array(0)
  private text = ''

  push(chunk: Uint8Array): { packets: Uint8Array[]; lines: string[] } {
    this.buf = this.buf.length === 0 ? chunk.slice() : concat(this.buf, chunk)
    const packets: Uint8Array[] = []
    const textBytes: number[] = []
    let at = 0
    while (at < this.buf.length) {
      if (this.buf[at] !== START1) {
        textBytes.push(this.buf[at]!)
        at++
        continue
      }
      if (at + 1 >= this.buf.length) break // второй байт ещё не дошёл
      if (this.buf[at + 1] !== START2) {
        textBytes.push(this.buf[at]!)
        at++
        continue
      }
      if (at + 4 > this.buf.length) break // длина ещё не дошла
      const len = (this.buf[at + 2]! << 8) | this.buf[at + 3]!
      if (len > MAX_PACKET_SIZE) {
        textBytes.push(this.buf[at]!)
        at++ // ложное начало: ищем следующее
        continue
      }
      if (at + 4 + len > this.buf.length) break // тело ещё не дошло
      packets.push(this.buf.slice(at + 4, at + 4 + len))
      at += 4 + len
    }
    this.buf = this.buf.slice(at)
    return { packets, lines: this.takeLines(textBytes) }
  }

  private takeLines(bytes: number[]): string[] {
    if (bytes.length === 0) return []
    this.text += new TextDecoder().decode(new Uint8Array(bytes), { stream: true })
    const parts = this.text.split(/\r?\n/)
    this.text = parts.pop() ?? ''
    // Хвост без перевода строки не копится бесконечно.
    if (this.text.length > 1024) {
      parts.push(this.text)
      this.text = ''
    }
    return parts.map((l) => l.trim()).filter((l) => l.length > 0)
  }
}

function callbacks<T>() {
  const set = new Set<(v: T) => void>()
  return {
    add(cb: (v: T) => void): Unsubscribe {
      set.add(cb)
      return () => set.delete(cb)
    },
    emit(v: T): void {
      for (const cb of [...set]) cb(v)
    },
  }
}

/** Пауза после «побудки», как у официального клиента на Python. */
const WAKE_PAUSE_MS = 100

export function packetLinkFromStream(link: ByteLink): PacketLink {
  const deframer = new StreamDeframer()
  const packets = callbacks<Uint8Array>()
  const lines = callbacks<string>()
  link.onData((chunk) => {
    const out = deframer.push(chunk)
    for (const line of out.lines) lines.emit(line)
    for (const p of out.packets) packets.emit(p)
  })
  return {
    kind: link.kind,
    label: link.label,
    send: (packet) => link.write(encodeStreamPacket(packet)),
    onPacket: packets.add,
    onText: lines.add,
    onClose: (cb) => link.onClose(cb),
    async wake() {
      await link.write(new Uint8Array(32).fill(START2))
      await new Promise((r) => setTimeout(r, WAKE_PAUSE_MS))
    },
    close: () => link.close(),
  }
}

/**
 * BLE: FromRadio вычитывается по одному, пока радио не вернёт пустое
 * значение. Читать начинаем после каждой записи (ответ мог уже лечь в
 * очередь) и по уведомлению fromNum. Чтения не пересекаются: пришло
 * уведомление во время чтения — после него прочитаем ещё раз.
 */
export async function packetLinkFromGatt(link: GattLink): Promise<PacketLink> {
  const packets = callbacks<Uint8Array>()
  let draining: Promise<void> | null = null
  let again = false
  let closed = false

  async function drainOnce(): Promise<void> {
    for (let i = 0; i < 1000 && !closed; i++) {
      const value = await link.read(BLE_FROM_RADIO)
      if (value.length === 0) return
      packets.emit(value)
    }
  }

  function drain(): Promise<void> {
    if (draining) {
      again = true
      return draining
    }
    draining = (async () => {
      try {
        do {
          again = false
          await drainOnce()
        } while (again && !closed)
      } finally {
        draining = null
      }
    })()
    return draining
  }

  link.onClose(() => {
    closed = true
  })
  await link.subscribe(BLE_FROM_NUM, () => {
    void drain().catch(() => {})
  })

  return {
    kind: 'ble',
    label: link.label,
    async send(packet) {
      if (packet.length > MAX_PACKET_SIZE) {
        throw new RangeError(`packet size ${packet.length} out of range`)
      }
      await link.write(BLE_TO_RADIO, packet, true)
      void drain().catch(() => {})
    },
    onPacket: packets.add,
    onText: () => () => {},
    onClose: (cb) => link.onClose(cb),
    async wake() {
      // Радио могло накопить пакеты до подключения — забираем.
      await drain().catch(() => {})
    },
    close: () => {
      closed = true
      return link.close()
    },
  }
}
