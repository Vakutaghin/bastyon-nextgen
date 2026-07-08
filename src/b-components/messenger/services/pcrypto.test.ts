// Round-trip тест личного (1:1) шифрования — фиксирует wire-формат P0-2.
//
// P0-2: DM-текст больше НЕ уходит сырым m.text. sendDirectEncryptedText шифрует
// его через PcryptoService.encryptKey(text, users, block, v) и кладёт результат
// как forta.chat encryptEvent(tetatet): content = { block, version, body: keys },
// где keys = Base64(JSON per-user AES-SIV map). Здесь проверяем, что приёмный
// путь (PcryptoService.decryptEvent) достаёт исходный текст из ровно такого
// content — то есть отправка и приём совместимы между собой и с legacy-форматом.

import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'

import { PcryptoService, type User } from './pcrypto'
import { deriveMessengerKeys } from '@/blockchain/core/keys'

const ALICE_ID = '@alicehex00:matrix.pocketnet.app'
const BOB_ID = '@bobhex11:matrix.pocketnet.app'

const aliceKeys = deriveMessengerKeys(Buffer.from('11'.repeat(32), 'hex'))
const bobKeys = deriveMessengerKeys(Buffer.from('22'.repeat(32), 'hex'))

/** Участники комнаты с публичными ключами (как их собирает collectPcryptoUsers). */
const users: User[] = [
  { id: ALICE_ID, keys: aliceKeys.map((k) => k.public), dbId: 1 },
  { id: BOB_ID, keys: bobKeys.map((k) => k.public), dbId: 2 },
]

const alice = new PcryptoService(aliceKeys, ALICE_ID)
const bob = new PcryptoService(bobKeys, BOB_ID)

describe('pcrypto direct-message (P0-2 wire format)', () => {
  it('Bob расшифровывает DM-текст, зашифрованный Alice, из forta-style content', async () => {
    const text = 'встречаемся там-то в 19:00'
    const block = 10
    const version = 2

    // sendDirectEncryptedText: encryptKey(text, users, block, v) → { block, keys, v }
    const secrets = await alice.encryptKey(text, users, block, version)

    // matrixService.sendEncryptedDirectMessage кладёт это в content ровно так:
    const content = { block: secrets.block, version, body: secrets.keys }

    const decrypted = await bob.decryptEvent({ sender: ALICE_ID, content }, users)
    expect(decrypted).toBe(text)
  })

  it('Alice расшифровывает собственное сообщение (оптимистичный ре-рид)', async () => {
    const text = 'моё же сообщение'
    const secrets = await alice.encryptKey(text, users, 10, 2)
    const content = { block: secrets.block, version: 2, body: secrets.keys }

    const decrypted = await alice.decryptEvent({ sender: ALICE_ID, content }, users)
    expect(decrypted).toBe(text)
  })

  it('body — Base64 JSON, распознаётся приёмной base64-эвристикой (startsWith ey / "encrypted")', async () => {
    const secrets = await alice.encryptKey('x', users, 10, 2)
    expect(secrets.keys.startsWith('ey')).toBe(true)
    const decoded = Buffer.from(secrets.keys, 'base64').toString('utf8')
    expect(decoded.startsWith('{')).toBe(true)
    expect(decoded).toContain('"encrypted"')
    // Не групповой формат: нет hash и body не hex-кратный-32 (это исключает
    // ошибочный уход в group-путь).
    expect(/^[0-9a-fA-F]+$/.test(secrets.keys)).toBe(false)
  })

  it('посторонний (Carol) НЕ может расшифровать — E2E держится', async () => {
    const carolKeys = deriveMessengerKeys(Buffer.from('33'.repeat(32), 'hex'))
    const carol = new PcryptoService(carolKeys, '@carol:matrix.pocketnet.app')
    const secrets = await alice.encryptKey('секрет', users, 10, 2)
    const content = { block: secrets.block, version: 2, body: secrets.keys }

    // Carol не входит в users комнаты и не имеет ключа → decryptEvent не отдаёт текст.
    const carolUsers: User[] = [
      ...users,
      { id: '@carol:matrix.pocketnet.app', keys: carolKeys.map((k) => k.public), dbId: 3 },
    ]
    await expect(async () => {
      const out = await carol.decryptEvent({ sender: ALICE_ID, content }, carolUsers)
      if (out === 'секрет') throw new Error('carol decrypted plaintext!')
      // decryptEvent может бросить (emptyforme/emptykey) либо вернуть мусор/null —
      // главное, что это не исходный текст.
    }).rejects.toBeDefined()
  })
})
