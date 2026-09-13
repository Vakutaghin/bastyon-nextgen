import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('../../services/matrix-service', () => ({ matrixService: { getClient: () => null } }))
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
