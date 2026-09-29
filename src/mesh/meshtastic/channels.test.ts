import { describe, expect, it } from 'vitest'

import { toHex } from '../bytes'
import {
  channelHash,
  channelIdOf,
  channelKindOf,
  DEFAULT_PSK,
  displayChannelName,
  expandPsk,
  isUnencrypted,
  randomPsk,
} from './channels'
import { decodeChannelUrl, encodeChannelUrl } from './codec'

describe('meshtastic channel keys', () => {
  it('expands the one-byte default key the way the firmware does', () => {
    expect(toHex(expandPsk(new Uint8Array([1])))).toBe(toHex(DEFAULT_PSK))
    const second = expandPsk(new Uint8Array([2]))
    expect(second[15]).toBe(0x02)
    expect(toHex(second.slice(0, 15))).toBe(toHex(DEFAULT_PSK.slice(0, 15)))
    expect(expandPsk(new Uint8Array([0]))).toHaveLength(0)
    expect(expandPsk(new Uint8Array(0))).toHaveLength(0)
  })

  it('pads short keys with zeros to AES sizes', () => {
    expect(expandPsk(new Uint8Array([9, 9, 9]))).toHaveLength(16)
    expect(expandPsk(new Uint8Array(20).fill(1))).toHaveLength(32)
    expect(expandPsk(new Uint8Array(32).fill(1))).toHaveLength(32)
  })

  it('calls a channel public when anyone knows its key', () => {
    expect(channelKindOf(new Uint8Array([1]))).toBe('public')
    expect(channelKindOf(new Uint8Array([5]))).toBe('public')
    expect(channelKindOf(new Uint8Array(0))).toBe('public')
    expect(channelKindOf(randomPsk())).toBe('private')
    expect(isUnencrypted(new Uint8Array([0]))).toBe(true)
    expect(isUnencrypted(new Uint8Array([1]))).toBe(false)
  })

  it('names the unnamed primary channel after the modem preset', () => {
    const primary = { index: 0, name: '', role: 'primary' }
    expect(displayChannelName(primary, { usePreset: true, modemPreset: 0 })).toBe('LongFast')
    expect(displayChannelName(primary, { usePreset: true, modemPreset: 4 })).toBe('MediumFast')
    expect(displayChannelName(primary, null)).toBe('LongFast')
    expect(displayChannelName({ index: 2, name: 'Family', role: 'secondary' }, null)).toBe('Family')
  })

  it('computes the on-air hash of the default channel as 8', () => {
    // LongFast с ключом по умолчанию — хэш 8, его видно в любом снифере Meshtastic.
    expect(channelHash('LongFast', new Uint8Array([1]))).toBe(8)
  })

  it('gives a channel the same id for the same name and key', async () => {
    const a = await channelIdOf('Family', new Uint8Array([7, 7]))
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(await channelIdOf('Family', new Uint8Array([7, 7]))).toBe(a)
    expect(await channelIdOf('Family', new Uint8Array([7, 8]))).not.toBe(a)
    // «AQ==» и полный ключ по умолчанию — один и тот же канал.
    expect(await channelIdOf('LongFast', new Uint8Array([1]))).toBe(
      await channelIdOf('LongFast', DEFAULT_PSK)
    )
  })
})

describe('meshtastic channel links', () => {
  it('reads the default channel link from the Meshtastic docs', () => {
    const share = decodeChannelUrl('https://meshtastic.org/e/#CgMSAQESBggBQANIAQ')
    expect(share?.channels).toHaveLength(1)
    expect(Array.from(share!.channels[0]!.psk)).toEqual([1])
    expect(share?.lora?.hopLimit).toBe(3)
    expect(share?.lora?.usePreset).toBe(true)
  })

  it('round-trips a channel through a link', () => {
    const psk = randomPsk()
    const url = encodeChannelUrl([{ name: 'Family', psk }], null, true)
    expect(url.startsWith('https://meshtastic.org/e/?add=true#')).toBe(true)
    const share = decodeChannelUrl(url)
    expect(share?.channels[0]?.name).toBe('Family')
    expect(toHex(share!.channels[0]!.psk)).toBe(toHex(psk))
  })

  it('refuses links that are not Meshtastic channel links', () => {
    expect(decodeChannelUrl('https://example.com/#CgMSAQE')).toBeNull()
    expect(decodeChannelUrl('https://meshtastic.org/e/#!!!')).toBeNull()
    expect(decodeChannelUrl('https://meshtastic.org/e/')).toBeNull()
  })
})
