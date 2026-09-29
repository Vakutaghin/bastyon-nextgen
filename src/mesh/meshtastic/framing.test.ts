import { describe, expect, it, vi } from 'vitest'

import { concat, utf8 } from '../bytes'
import type { CloseReason, GattLink } from '../radio/types'
import { BLE_FROM_NUM, BLE_FROM_RADIO, BLE_TO_RADIO, START1, START2 } from './constants'
import { encodeStreamPacket, packetLinkFromGatt, StreamDeframer } from './framing'

const frame = (...bytes: number[]) => encodeStreamPacket(new Uint8Array(bytes))

describe('meshtastic stream framing', () => {
  it('prefixes a packet with the start bytes and a big-endian length', () => {
    const body = new Uint8Array(300).fill(7)
    const out = encodeStreamPacket(body)
    expect(Array.from(out.slice(0, 4))).toEqual([START1, START2, 0x01, 0x2c])
    expect(out.length).toBe(304)
    expect(() => encodeStreamPacket(new Uint8Array(513))).toThrow(RangeError)
  })

  it('splits packets and hands the board text over as lines', () => {
    const d = new StreamDeframer()
    const out = d.push(
      concat(utf8('INFO | boot\r\n'), frame(1, 2, 3), utf8('DEBUG | x\n'), frame(9))
    )
    expect(out.packets.map((p) => Array.from(p))).toEqual([[1, 2, 3], [9]])
    expect(out.lines).toEqual(['INFO | boot', 'DEBUG | x'])
  })

  it('waits for the rest of a packet that came in pieces', () => {
    const d = new StreamDeframer()
    const whole = frame(10, 20, 30, 40)
    expect(d.push(whole.slice(0, 1)).packets).toEqual([])
    expect(d.push(whole.slice(1, 5)).packets).toEqual([])
    expect(d.push(whole.slice(5)).packets.map((p) => Array.from(p))).toEqual([[10, 20, 30, 40]])
  })

  it('skips a start byte that is not followed by the second one or has an impossible length', () => {
    const d = new StreamDeframer()
    const bogus = new Uint8Array([START1, 0x41, START1, START2, 0xff, 0xff])
    const out = d.push(concat(bogus, frame(5)))
    expect(out.packets.map((p) => Array.from(p))).toEqual([[5]])
  })

  it('passes an empty packet through (an empty FromRadio is valid protobuf)', () => {
    const d = new StreamDeframer()
    expect(d.push(frame()).packets).toHaveLength(1)
  })
})

function fakeGatt(queue: Uint8Array[]) {
  let notify: ((d: Uint8Array) => void) | null = null
  const closeCbs = new Set<(r: CloseReason) => void>()
  const writes: Array<{ ch: string; data: number[] }> = []
  const link: GattLink = {
    kind: 'ble',
    label: 'radio',
    write: vi.fn(async (ch: string, data: Uint8Array) => {
      writes.push({ ch, data: Array.from(data) })
    }),
    read: vi.fn(async (ch: string) => {
      expect(ch).toBe(BLE_FROM_RADIO)
      return queue.shift() ?? new Uint8Array(0)
    }),
    subscribe: vi.fn(async (ch: string, cb: (d: Uint8Array) => void) => {
      expect(ch).toBe(BLE_FROM_NUM)
      notify = cb
      return () => {
        notify = null
      }
    }),
    onClose: (cb) => {
      closeCbs.add(cb)
      return () => closeCbs.delete(cb)
    },
    close: vi.fn(async () => {}),
  }
  return { link, writes, fire: () => notify?.(new Uint8Array([1, 0, 0, 0])) }
}

describe('meshtastic over bluetooth', () => {
  it('writes to toRadio and then reads fromRadio until it is empty', async () => {
    const queue = [new Uint8Array([1]), new Uint8Array([2])]
    const g = fakeGatt(queue)
    const link = await packetLinkFromGatt(g.link)
    const got: number[][] = []
    link.onPacket((p) => got.push(Array.from(p)))
    await link.send(new Uint8Array([42]))
    await vi.waitFor(() => expect(got).toEqual([[1], [2]]))
    expect(g.writes).toEqual([{ ch: BLE_TO_RADIO, data: [42] }])
  })

  it('reads again when fromNum says there is more', async () => {
    const queue: Uint8Array[] = []
    const g = fakeGatt(queue)
    const link = await packetLinkFromGatt(g.link)
    const got: number[][] = []
    link.onPacket((p) => got.push(Array.from(p)))
    queue.push(new Uint8Array([7]))
    g.fire()
    await vi.waitFor(() => expect(got).toEqual([[7]]))
  })
})
