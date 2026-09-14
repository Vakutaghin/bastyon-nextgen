import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    // baseUrl задаёт доверенный origin медиа (S34): всё, что не на https://hs, отбрасывается.
    getClient: () => ({
      baseUrl: 'https://hs',
      mxcUrlToHttp: (u: string) => `https://hs/media/${u.slice(6)}`,
    }),
  },
}))
vi.mock('../../services/group-encryption', () => ({
  isGroupEncryptedContent: (c: { msgtype?: string }) => c.msgtype === 'm.group.encrypted',
}))

import { useMessageMapping } from './use-message-mapping'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'

// Минимальный matrix-event в форме, которую понимают хелперы getEvent*.
function mxEvent(type: string, content: Record<string, unknown>) {
  return {
    event_id: '$e1',
    room_id: '!room:pocketnet',
    sender: '@pabc:pocketnet',
    origin_server_ts: 1,
    type,
    content,
    getId: () => '$e1',
    getRoomId: () => '!room:pocketnet',
    getSender: () => '@pabc:pocketnet',
    getTs: () => 1,
    getType: () => type,
    getContent: () => content,
  } as never
}

function mapping(tryDecrypt: (e: unknown) => Promise<string | null>) {
  const ctx = {
    currentUser: ref({ id: '@me:pocketnet', name: 'me' }),
    profileCache: { userProfiles: {}, fetchProfiles: vi.fn() },
  }
  return useMessageMapping(ctx as never, { tryDecrypt } as never)
}

describe('mapEventToMessage — нерасшифрованное сообщение (P3-2)', () => {
  it('m.room.encrypted с непустым body (legacy hex) при сбое дешифровки → плейсхолдер, не шифротекст', async () => {
    const { mapEventToMessage } = mapping(async () => null)
    const msg = await mapEventToMessage(
      mxEvent('m.room.encrypted', { msgtype: 'm.text', body: 'deadbeefcafe0011' })
    )
    expect(msg?.text).toBe(ENCRYPTED_MESSAGE_PLACEHOLDER)
  })

  it('body с секретами (base64 JSON) при сбое дешифровки → плейсхолдер', async () => {
    const body = btoa(JSON.stringify({ encrypted: 'x', keys: 'k', cipher: 'c' }))
    const { mapEventToMessage } = mapping(async () => null)
    const msg = await mapEventToMessage(mxEvent('m.room.message', { msgtype: 'm.text', body }))
    expect(msg?.text).toBe(ENCRYPTED_MESSAGE_PLACEHOLDER)
  })

  it('skipDecryption: короткий hex-шифротекст не показывается как текст', async () => {
    const { mapEventToMessage } = mapping(async () => 'never called')
    const msg = await mapEventToMessage(
      mxEvent('m.room.encrypted', { msgtype: 'm.text', body: 'abcd1234' }),
      true
    )
    expect(msg?.text).toBe(ENCRYPTED_MESSAGE_PLACEHOLDER)
  })

  it('успешная дешифровка отдаёт текст', async () => {
    const { mapEventToMessage } = mapping(async () =>
      JSON.stringify({ msgtype: 'm.text', body: 'hi' })
    )
    const msg = await mapEventToMessage(
      mxEvent('m.room.encrypted', { msgtype: 'm.text', body: 'deadbeef' })
    )
    expect(msg?.text).toBe('hi')
  })
})

describe('mapEventToMessage — медиа и транзакции (K3)', () => {
  const secrets = { keys: 'wrapped', block: 10 }

  it('m.image → type image, url http, info с секретами; tryDecrypt не зовётся, hex в text не попадает', async () => {
    const tryDecrypt = vi.fn(async () => 'deadbeef'.repeat(8))
    const { mapEventToMessage } = mapping(tryDecrypt)
    const msg = await mapEventToMessage(
      mxEvent('m.room.message', {
        msgtype: 'm.image',
        body: 'cat.jpg',
        url: 'mxc://hs/img',
        info: { mimetype: 'image/jpeg', w: 1, h: 2, size: 3, secrets },
      })
    )
    expect(tryDecrypt).not.toHaveBeenCalled()
    expect(msg).toMatchObject({ type: 'image', url: 'https://hs/media/hs/img', text: 'cat.jpg' })
    expect(msg?.info).toMatchObject({ secrets, name: 'cat.jpg', w: 1, h: 2 })
  })

  it('m.video → type video с posterUrl; m.file legacy-JSON → type file с именем/размером', async () => {
    const { mapEventToMessage } = mapping(async () => null)
    const video = await mapEventToMessage(
      mxEvent('m.room.message', {
        msgtype: 'm.video',
        body: 'v.mp4',
        url: 'mxc://hs/v',
        info: { thumbnail_url: 'mxc://hs/p', secrets },
      })
    )
    expect(video).toMatchObject({ type: 'video', url: 'https://hs/media/hs/v' })
    expect(video?.info?.posterUrl).toBe('https://hs/media/hs/p')

    const body = JSON.stringify({
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 9,
      url: 'https://hs/f',
      secrets,
    })
    const file = await mapEventToMessage(
      mxEvent('m.room.message', { msgtype: 'm.file', body, info: {} })
    )
    expect(file).toMatchObject({ type: 'file', url: 'https://hs/f', text: 'doc.pdf' })
    expect(file?.info).toMatchObject({
      name: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 9,
      secrets,
    })
  })

  it('медиа не теряется в превью (skipDecryption) и без текста не отбрасывается', async () => {
    const { mapEventToMessage } = mapping(async () => null)
    const msg = await mapEventToMessage(
      mxEvent('m.room.message', {
        msgtype: 'm.audio',
        body: '',
        url: 'mxc://hs/a',
        info: { secrets },
      }),
      true
    )
    expect(msg).toMatchObject({ type: 'audio', url: 'https://hs/media/hs/a', text: '' })
  })

  it('S34: абсолютный URL медиа с чужого хоста не попадает в message.url/info', async () => {
    const { mapEventToMessage } = mapping(async () => null)
    const msg = await mapEventToMessage(
      mxEvent('m.room.message', {
        msgtype: 'm.image',
        body: 'track.png',
        url: 'https://evil.example/track.png',
        info: {
          httpUrl: 'https://evil.example/track2.png',
          thumbnail_url: 'https://evil.example/t.png',
        },
      })
    )
    expect(msg?.type).toBe('image')
    expect(msg?.url).toBeFalsy()
    expect(msg?.info).not.toHaveProperty('httpUrl')
    expect(msg?.info).not.toHaveProperty('thumbnail_url')
  })

  it('S33: encrypted=true для E2E-событий, false для открытого m.text', async () => {
    const { mapEventToMessage } = mapping(async () =>
      JSON.stringify({ msgtype: 'm.text', body: 'hi' })
    )
    const enc = await mapEventToMessage(
      mxEvent('m.room.encrypted', { msgtype: 'm.text', body: 'deadbeef' })
    )
    expect(enc?.encrypted).toBe(true)
    const legacy = await mapEventToMessage(
      mxEvent('m.room.message', { msgtype: 'm.encrypted', body: 'deadbeef' })
    )
    expect(legacy?.encrypted).toBe(true)
    const plain = await mapEventToMessage(
      mxEvent('m.room.message', { msgtype: 'm.text', body: 'https://example.org' })
    )
    expect(plain?.encrypted).toBe(false)
  })

  it('m.text с pocketnet_transaction → карточка транзакции', async () => {
    const { mapEventToMessage } = mapping(async () => null)
    const tx = { txid: 'T', amount: 1.5, from: 'A', to: 'B', message: 'hi' }
    const msg = await mapEventToMessage(
      mxEvent('m.room.message', {
        msgtype: 'm.text',
        body: '💎 1.5 PKOIN · hi',
        pocketnet_transaction: tx,
      })
    )
    expect(msg).toMatchObject({ type: 'transaction', text: '💎 1.5 PKOIN · hi' })
    expect(msg?.info?.transaction).toEqual(tx)
  })

  it('медиа внутри расшифрованного m.room.encrypted тоже маппится по msgtype', async () => {
    const inner = { msgtype: 'm.image', body: 'secret.png', url: 'mxc://hs/s', info: { secrets } }
    const { mapEventToMessage } = mapping(async () => JSON.stringify(inner))
    const msg = await mapEventToMessage(
      mxEvent('m.room.encrypted', { msgtype: 'm.text', body: 'deadbeef' })
    )
    expect(msg).toMatchObject({ type: 'image', url: 'https://hs/media/hs/s', text: 'secret.png' })
  })
})
