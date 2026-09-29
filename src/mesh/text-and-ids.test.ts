// Длина текста в байтах UTF-8, разбиение на части для эфира и id диалогов.

import { describe, expect, it } from 'vitest'
import { truncateUtf8, utf8Length } from './bytes'
import {
  channelDialogId,
  directDialogId,
  isMeshDialogId,
  meshSenderId,
  parseMeshDialogId,
} from './ids'
import { bytesLeft, splitForMesh } from './text'

const SELF = 'a1'.repeat(32)
const PEER = 'b2'.repeat(32)

describe('UTF-8 length', () => {
  it('counts bytes, not letters', () => {
    expect(utf8Length('abc')).toBe(3)
    expect(utf8Length('абв')).toBe(6)
    expect(utf8Length('👍')).toBe(4)
    expect(bytesLeft('абв ', 160)).toBe(154)
  })

  it('never cuts a character in half', () => {
    expect(truncateUtf8('абв', 5)).toBe('аб')
    expect(truncateUtf8('a👍b', 4)).toBe('a')
    expect(truncateUtf8('a👍b', 5)).toBe('a👍')
    expect(truncateUtf8('text', 0)).toBe('')
  })
})

describe('splitForMesh', () => {
  it('keeps a short text as is', () => {
    expect(splitForMesh('  привет  ', 160)).toEqual(['привет'])
    expect(splitForMesh('   ', 160)).toEqual([])
  })

  it('numbers the parts and fits each into the limit', () => {
    const text = 'слово '.repeat(40).trim() // 40 слов по 10–11 байт
    const parts = splitForMesh(text, 160)!
    expect(parts.length).toBeGreaterThan(1)
    parts.forEach((p, i) => {
      expect(p.startsWith(`(${i + 1}/${parts.length}) `)).toBe(true)
      expect(utf8Length(p)).toBeLessThanOrEqual(160)
      // Режется по пробелам: слово не разорвано.
      expect(
        p
          .replace(/^\(\d\/\d\) /, '')
          .split(' ')
          .every((w) => w === 'слово')
      ).toBe(true)
    })
    expect(parts.map((p) => p.replace(/^\(\d\/\d\) /, '')).join(' ')).toBe(text)
  })

  it('cuts a text without spaces at character boundaries', () => {
    const parts = splitForMesh('ж'.repeat(120), 100)!
    expect(parts.every((p) => utf8Length(p) <= 100)).toBe(true)
    expect(parts.map((p) => p.replace(/^\(\d\/\d\) /, '')).join('')).toBe('ж'.repeat(120))
  })

  it('refuses a text that needs too many parts', () => {
    expect(splitForMesh('я'.repeat(1000), 160)).toBeNull()
    expect(splitForMesh('long text', 4)).toBeNull()
  })
})

describe('mesh dialog ids', () => {
  it('builds and parses direct and channel ids', () => {
    const direct = directDialogId('meshcore', SELF, PEER)
    expect(direct).toBe(`mesh:mc:${SELF.slice(0, 12)}:u:${PEER.slice(0, 12)}`)
    expect(parseMeshDialogId(direct)).toEqual({
      network: 'meshcore',
      selfKey: SELF.slice(0, 12),
      kind: 'direct',
      key: PEER.slice(0, 12),
    })
    const channel = channelDialogId('meshcore', SELF, '0123456789abcdef')
    expect(parseMeshDialogId(channel)).toMatchObject({ kind: 'channel', key: '0123456789abcdef' })
  })

  it('tells mesh dialogs from Matrix rooms', () => {
    expect(isMeshDialogId('!abc:matrix.pocketnet.app')).toBe(false)
    expect(isMeshDialogId(null)).toBe(false)
    expect(isMeshDialogId(directDialogId('meshcore', SELF, PEER))).toBe(true)
    expect(parseMeshDialogId('mesh:xx:1:u:2')).toBeNull()
    expect(parseMeshDialogId('mesh:mc:1:z:2')).toBeNull()
  })

  it('names senders by key or, in channels, by the name their radio wrote', () => {
    expect(meshSenderId('meshcore', { key: PEER })).toBe(`mesh:mc:u:${PEER.slice(0, 12)}`)
    expect(meshSenderId('meshcore', { name: 'Bob' })).toBe('mesh:mc:n:Bob')
  })
})
