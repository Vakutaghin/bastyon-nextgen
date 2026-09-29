// Кодек companion-протокола: кадры собраны вручную по раскладке MyMesh.cpp,
// а не тем же кодом, которым разбираются.

import { describe, expect, it } from 'vitest'
import { concat, fromHex, toHex, u16le, u32le, utf8 } from '../bytes'
import { channelId, channelKind, hashtagSecret, normalizeHashtag } from './channels'
import {
  decodeBattery,
  decodeChannelInfo,
  decodeContact,
  decodeDeviceInfo,
  decodeIncoming,
  decodeSelfInfo,
  decodeSendConfirmed,
  decodeSent,
  encode,
  hopCount,
  isEmptyChannel,
  splitChannelText,
} from './codec'
import { CMD, PUBLIC_CHANNEL_SECRET, PUSH, RESP } from './constants'

const KEY = 'ab'.repeat(16) + 'cd'.repeat(16)
const pad = (text: string, size: number) => {
  const out = new Uint8Array(size)
  out.set(utf8(text))
  return out
}
const i32 = (v: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setInt32(0, v, true)
  return b
}

describe('commands', () => {
  it('APP_START: code, 7 reserved bytes, app name', () => {
    expect([...encode.appStart('mccli')]).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0x6d, 0x63, 0x63, 0x6c, 0x69,
    ])
  })

  it('DEVICE_QUERY and SET_DEVICE_TIME', () => {
    expect([...encode.deviceQuery(3)]).toEqual([0x16, 0x03])
    expect([...encode.setDeviceTime(1234567890)]).toEqual([6, 0xd2, 0x02, 0x96, 0x49])
  })

  it('channel message like the protocol example', () => {
    // docs/companion_protocol.md: 03 00 01 D2 02 96 49 48 65 6C 6C 6F
    expect(toHex(encode.sendChannelText(1, 'Hello', 1234567890))).toBe('030001d202964948656c6c6f')
  })

  it('direct message addresses the first six key bytes', () => {
    const f = encode.sendText(KEY, 'Привет', 1000, 2)
    expect(f[0]).toBe(CMD.SEND_TXT_MSG)
    expect(f[1]).toBe(0) // TXT_TYPE_PLAIN
    expect(f[2]).toBe(2) // attempt
    expect(toHex(f.slice(7, 13))).toBe(KEY.slice(0, 12))
    expect(new TextDecoder().decode(f.slice(13))).toBe('Привет')
  })

  it('SET_CHANNEL is 50 bytes with a zero-terminated name', () => {
    const f = encode.setChannel(1, 'YourChannelName', '00112233445566778899aabbccddeeff')
    expect(f.length).toBe(50)
    expect(f[0]).toBe(CMD.SET_CHANNEL)
    expect(f[1]).toBe(1)
    expect(new TextDecoder().decode(f.slice(2, 17))).toBe('YourChannelName')
    expect(f[17]).toBe(0)
    expect(toHex(f.slice(34))).toBe('00112233445566778899aabbccddeeff')
    // Имя длиннее поля обрезается так, чтобы ноль в конце остался.
    expect(encode.setChannel(0, 'x'.repeat(40), '00'.repeat(16))[33]).toBe(0)
  })

  it('contact frame round-trips', () => {
    const contact = {
      publicKey: KEY,
      type: 1,
      flags: 0,
      outPathLen: 0xff,
      name: 'Алиса',
      lastAdvert: 1_700_000_000,
      lat: 55.75,
      lon: 37.61,
      lastMod: 1_700_000_100,
    }
    const f = encode.addUpdateContact(contact)
    expect(f.length).toBe(148)
    expect(decodeContact(f)).toEqual(contact)
  })
})

describe('frames from the radio', () => {
  it('SELF_INFO', () => {
    const f = concat(
      new Uint8Array([RESP.SELF_INFO, 1, 22, 30]),
      fromHex(KEY),
      i32(55_751_244),
      i32(37_618_423),
      new Uint8Array([1, 0, 0x15, 0]),
      u32le(869_618),
      u32le(62_500),
      new Uint8Array([8, 8]),
      utf8('Base-1')
    )
    const s = decodeSelfInfo(f)
    expect(s.publicKey).toBe(KEY)
    expect(s.txPower).toBe(22)
    expect(s.lat).toBeCloseTo(55.751244)
    expect(s.lon).toBeCloseTo(37.618423)
    expect(s.radioFreq).toBeCloseTo(869.618)
    expect(s.radioBw).toBe(62.5)
    expect(s.radioSf).toBe(8)
    expect(s.name).toBe('Base-1')
    expect(s.manualAddContacts).toBe(false)
  })

  it('DEVICE_INFO of a current firmware and of a very old one', () => {
    const f = concat(
      new Uint8Array([RESP.DEVICE_INFO, 13, 175, 40]),
      u32le(123456),
      pad('20-Sep-2026', 12),
      pad('Heltec V3', 40),
      pad('v1.17.1', 20),
      new Uint8Array([0, 0])
    )
    expect(decodeDeviceInfo(f)).toEqual({
      firmwareVerCode: 13,
      maxContacts: 350,
      maxChannels: 40,
      blePin: 123456,
      buildDate: '20-Sep-2026',
      model: 'Heltec V3',
      version: 'v1.17.1',
    })
    expect(decodeDeviceInfo(new Uint8Array([RESP.DEVICE_INFO, 2]))).toMatchObject({
      firmwareVerCode: 2,
      maxChannels: null,
    })
  })

  it('CHANNEL_INFO keeps only the name up to the zero byte', () => {
    // strcpy в поле 32 байта: после нуля может лежать мусор прошлого кадра.
    const name = pad('Public', 32)
    name.set(utf8('garbage'), 20)
    const info = decodeChannelInfo(
      concat(new Uint8Array([RESP.CHANNEL_INFO, 0]), name, fromHex(PUBLIC_CHANNEL_SECRET))
    )
    expect(info).toEqual({ index: 0, name: 'Public', secret: PUBLIC_CHANNEL_SECRET })
    expect(isEmptyChannel({ index: 3, name: '', secret: '00'.repeat(16) })).toBe(true)
  })

  it('SENT and SEND_CONFIRMED carry the same raw ACK bytes', () => {
    const sent = decodeSent(
      concat(new Uint8Array([RESP.SENT, 1, 0xde, 0xad, 0xbe, 0xef]), u32le(12000))
    )
    expect(sent).toEqual({ flood: true, ack: 'deadbeef', timeoutMs: 12000 })
    const confirmed = decodeSendConfirmed(
      concat(new Uint8Array([PUSH.SEND_CONFIRMED, 0xde, 0xad, 0xbe, 0xef]), u32le(2300))
    )
    expect(confirmed).toEqual({ ack: 'deadbeef', tripMs: 2300 })
  })

  it('messages of both protocol versions', () => {
    const v2 = concat(
      new Uint8Array([RESP.CONTACT_MSG_RECV]),
      fromHex(KEY.slice(0, 12)),
      new Uint8Array([0xff, 0]),
      u32le(1000),
      utf8('hi')
    )
    expect(decodeIncoming(v2)).toMatchObject({
      kind: 'contact',
      senderPrefix: KEY.slice(0, 12),
      pathLen: 0xff,
      text: 'hi',
      snr: null,
    })

    const v3 = concat(
      new Uint8Array([RESP.CONTACT_MSG_RECV_V3, 0xf6, 0, 0]),
      fromHex(KEY.slice(0, 12)),
      new Uint8Array([2, 0]),
      u32le(1001),
      utf8('Как дела?')
    )
    expect(decodeIncoming(v3)).toMatchObject({
      kind: 'contact',
      snr: -2.5,
      pathLen: 2,
      text: 'Как дела?',
    })

    // Пост в комнате: 4 байта префикса автора перед текстом.
    const signed = concat(
      new Uint8Array([RESP.CONTACT_MSG_RECV_V3, 20, 0, 0]),
      fromHex(KEY.slice(0, 12)),
      new Uint8Array([1, 2]),
      u32le(5),
      fromHex('a1b2c3d4'),
      utf8('post')
    )
    expect(decodeIncoming(signed)).toMatchObject({ authorPrefix: 'a1b2c3d4', text: 'post' })

    const ch = concat(
      new Uint8Array([RESP.CHANNEL_MSG_RECV_V3, 12, 0, 0, 3, 1, 0]),
      u32le(77),
      utf8('Bob: yo')
    )
    expect(decodeIncoming(ch)).toMatchObject({
      kind: 'channel',
      channelIndex: 3,
      snr: 3,
      senderTimestamp: 77,
      text: 'Bob: yo',
    })

    const data = concat(
      new Uint8Array([RESP.CHANNEL_DATA_RECV, 8, 0, 0, 1, 0xff]),
      u16le(0xff00),
      new Uint8Array([3, 1, 2, 3])
    )
    expect(decodeIncoming(data)).toMatchObject({
      kind: 'channelData',
      channelIndex: 1,
      dataType: 0xff00,
      payload: new Uint8Array([1, 2, 3]),
    })
  })

  it('BATT_AND_STORAGE', () => {
    expect(
      decodeBattery(
        concat(new Uint8Array([RESP.BATT_AND_STORAGE]), u16le(4012), u32le(12), u32le(256))
      )
    ).toEqual({
      millivolts: 4012,
      usedKb: 12,
      totalKb: 256,
    })
  })

  it('hop count from the encoded path length', () => {
    expect(hopCount(0xff)).toBeNull()
    expect(hopCount(3)).toBe(3)
    expect(hopCount(0x42)).toBe(2) // размер хэша в старших битах не считается
  })
})

describe('channel text and keys', () => {
  it('splits «name: text» written by the sender radio', () => {
    expect(splitChannelText('Bob: hello: world')).toEqual({ sender: 'Bob', body: 'hello: world' })
    expect(splitChannelText('no sender here')).toEqual({ sender: null, body: 'no sender here' })
  })

  it('hashtag keys match the protocol example', async () => {
    // docs/companion_protocol.md: #test → 9cd8fcf22a47333b591d96a2b848b73f
    expect(await hashtagSecret('#test')).toBe('9cd8fcf22a47333b591d96a2b848b73f')
    expect(await hashtagSecret(' test')).toBe('9cd8fcf22a47333b591d96a2b848b73f')
    expect(normalizeHashtag('##moscow ')).toBe('#moscow')
  })

  it('tells public, hashtag and private channels apart', async () => {
    expect(await channelKind('Public', PUBLIC_CHANNEL_SECRET)).toBe('public')
    expect(await channelKind('#test', '9cd8fcf22a47333b591d96a2b848b73f')).toBe('hashtag')
    expect(await channelKind('#test', '00112233445566778899aabbccddeeff')).toBe('private')
    expect(await channelKind('Family', '00112233445566778899aabbccddeeff')).toBe('private')
  })

  it('channel id depends only on the key', async () => {
    const a = await channelId(PUBLIC_CHANNEL_SECRET)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(await channelId(PUBLIC_CHANNEL_SECRET)).toBe(a)
    expect(await channelId('9cd8fcf22a47333b591d96a2b848b73f')).not.toBe(a)
  })
})
