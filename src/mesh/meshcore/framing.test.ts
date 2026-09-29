// Нарезка потока USB-serial/TCP на кадры MeshCore и обрамление команд.

import { describe, expect, it, vi } from 'vitest'
import { concat } from '../bytes'
import type { ByteLink, GattLink } from '../radio/types'
import { NUS_RX, NUS_TX } from './constants'
import {
  APP_TO_RADIO,
  encodeStreamFrame,
  frameLinkFromGatt,
  frameLinkFromStream,
  RADIO_TO_APP,
  StreamDeframer,
} from './framing'

const frame = (...bytes: number[]) => new Uint8Array(bytes)
const fromRadio = (body: Uint8Array) => encodeStreamFrame(body, RADIO_TO_APP)

describe('encodeStreamFrame', () => {
  it('adds the direction marker and the little-endian length', () => {
    expect([...encodeStreamFrame(frame(0x0a))]).toEqual([APP_TO_RADIO, 1, 0, 0x0a])
    const big = new Uint8Array(170).fill(7)
    expect([...encodeStreamFrame(big).slice(0, 3)]).toEqual([APP_TO_RADIO, 170, 0])
  })

  it('refuses empty and oversized frames', () => {
    expect(() => encodeStreamFrame(new Uint8Array(0))).toThrow(RangeError)
    expect(() => encodeStreamFrame(new Uint8Array(177))).toThrow(RangeError)
  })
})

describe('StreamDeframer', () => {
  it('joins a frame that arrives in pieces', () => {
    const d = new StreamDeframer()
    const bytes = fromRadio(frame(5, 1, 2, 3))
    expect(d.push(bytes.slice(0, 1))).toEqual([])
    expect(d.push(bytes.slice(1, 4))).toEqual([])
    expect(d.push(bytes.slice(4))).toEqual([frame(5, 1, 2, 3)])
  })

  it('returns every frame of one chunk in order', () => {
    const d = new StreamDeframer()
    const out = d.push(concat(fromRadio(frame(0)), fromRadio(frame(0x83)), fromRadio(frame(10))))
    expect(out).toEqual([frame(0), frame(0x83), frame(10)])
  })

  it('skips boot text and false markers', () => {
    const d = new StreamDeframer()
    const noise = new TextEncoder().encode('ESP-ROM:esp32s3 > boot ok\r\n')
    // «>» в тексте с огромной «длиной» — не кадр, разбор продолжается.
    const out = d.push(
      concat(noise, new Uint8Array([RADIO_TO_APP, 0xff, 0xff]), fromRadio(frame(9, 9)))
    )
    expect(out).toEqual([frame(9, 9)])
  })

  it('ignores frames going the other way', () => {
    const d = new StreamDeframer(RADIO_TO_APP)
    expect(d.push(encodeStreamFrame(frame(1, 2), APP_TO_RADIO))).toEqual([])
  })
})

describe('frameLinkFromStream', () => {
  it('frames writes and deframes data', async () => {
    let onData: ((d: Uint8Array) => void) | null = null
    const write = vi.fn(async (_d: Uint8Array) => {})
    const byteLink: ByteLink = {
      kind: 'serial',
      label: '/dev/cu.usbserial-1',
      write,
      onData: (cb) => {
        onData = cb
        return () => {}
      },
      onClose: () => () => {},
      close: async () => {},
    }
    const link = frameLinkFromStream(byteLink)
    const got: Uint8Array[] = []
    link.onFrame((f) => got.push(f))
    await link.send(frame(22, 3))
    expect([...write.mock.calls[0]![0]]).toEqual([APP_TO_RADIO, 2, 0, 22, 3])
    const reply = fromRadio(frame(13, 13))
    onData!(reply.slice(0, 2))
    onData!(reply.slice(2))
    expect(got).toEqual([frame(13, 13)])
  })
})

describe('frameLinkFromGatt', () => {
  it('subscribes to TX, writes whole frames to RX with response', async () => {
    let notify: ((d: Uint8Array) => void) | null = null
    const write = vi.fn(async (_c: string, _d: Uint8Array, _r?: boolean) => {})
    const subscribe = vi.fn(async (_c: string, cb: (d: Uint8Array) => void) => {
      notify = cb
      return () => {}
    })
    const gatt: GattLink = {
      kind: 'ble',
      label: 'MeshCore-1',
      write,
      read: async () => new Uint8Array(0),
      subscribe,
      onClose: () => () => {},
      close: async () => {},
    }
    const link = await frameLinkFromGatt(gatt)
    expect(subscribe.mock.calls[0]![0]).toBe(NUS_TX)
    const got: Uint8Array[] = []
    link.onFrame((f) => got.push(f))
    await link.send(frame(1, 0, 0, 0, 0, 0, 0, 0))
    expect(write).toHaveBeenCalledWith(NUS_RX, frame(1, 0, 0, 0, 0, 0, 0, 0), true)
    notify!(frame(5, 1))
    notify!(new Uint8Array(0)) // пустое уведомление — не кадр
    expect(got).toEqual([frame(5, 1)])
  })
})
