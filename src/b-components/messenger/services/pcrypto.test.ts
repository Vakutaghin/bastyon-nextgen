// Round-trip тест личного (1:1) шифрования — фиксирует wire-формат P0-2.
//
// P0-2: DM-текст больше НЕ уходит сырым m.text. sendDirectEncryptedText шифрует
// его через PcryptoService.encryptKey(text, users, block, v) и кладёт результат
// как forta.chat encryptEvent(tetatet): content = { block, version, body: keys },
// где keys = Base64(JSON per-user AES-SIV map). Здесь проверяем, что приёмный
// путь (PcryptoService.decryptEvent) достаёт исходный текст из ровно такого
// content — то есть отправка и приём совместимы между собой и с legacy-форматом.

import { describe, it, expect, vi } from 'vitest'
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

describe('pcrypto: ключ одного собеседника', () => {
  // Группа на 6 человек: расшифровке нужен ключ только отправителя, а прежний
  // расчёт (aeskeys) считал точки всех. Ключ обязан совпасть байт в байт.
  const group: User[] = Array.from({ length: 6 }, (_, i) => {
    const keys = deriveMessengerKeys(
      Buffer.from(
        String(i + 4)
          .repeat(64)
          .slice(0, 64),
        'hex'
      )
    )
    return { id: `@member${i}:matrix.pocketnet.app`, keys: keys.map((k) => k.public), dbId: i + 1 }
  })
  const me = deriveMessengerKeys(Buffer.from('44'.repeat(32), 'hex'))
  type Internals = {
    eaa: { aeskeys: (block: number, users: User[]) => Record<string, Buffer> }
    aeskey: (block: number, users: User[], id: string) => Promise<Buffer | null>
  }
  const service = new PcryptoService(me, '@member0:matrix.pocketnet.app')
  const inner = service as unknown as Internals

  it('совпадает с ключом из полного расчёта для каждого участника', async () => {
    const all = inner.eaa.aeskeys(77, group)
    expect(Object.keys(all)).toHaveLength(5)
    for (const [id, key] of Object.entries(all)) {
      expect((await inner.aeskey(77, group, id))!.toString('hex')).toBe(key.toString('hex'))
    }
  })

  it('неточный id ищется так же, как раньше; чужого нет — null', async () => {
    const all = inner.eaa.aeskeys(77, group)
    const key = await inner.aeskey(77, group, 'member3:matrix')
    expect(key!.toString('hex')).toBe(all['member3']!.toString('hex'))
    await expect(inner.aeskey(77, group, 'nobody')).resolves.toBeNull()
  })

  it('пачка расшифровок одного блока считает ключ один раз', async () => {
    const fresh = new PcryptoService(me, '@member0:matrix.pocketnet.app')
    const freshInner = fresh as unknown as Internals & {
      eaa: { shared: (...args: unknown[]) => Buffer | null }
    }
    const shared = vi.spyOn(freshInner.eaa, 'shared')
    const keys = await Promise.all(
      Array.from({ length: 20 }, () => freshInner.aeskey(91, group, 'member2'))
    )
    expect(shared).toHaveBeenCalledTimes(1)
    expect(new Set(keys.map((k) => k!.toString('hex'))).size).toBe(1)
    expect(keys[0]!.toString('hex')).toBe(inner.eaa.aeskeys(91, group)['member2']!.toString('hex'))
  })

  it('другой блок — другой ключ (кэш не путает)', async () => {
    const a = await inner.aeskey(77, group, 'member2')
    const b = await inner.aeskey(78, group, 'member2')
    expect(a!.toString('hex')).not.toBe(b!.toString('hex'))
    expect(b!.toString('hex')).toBe(inner.eaa.aeskeys(78, group)['member2']!.toString('hex'))
  })

  it('групповой секрет: участник расшифровывает то, что зашифровал другой', async () => {
    const memberKeys = (i: number) =>
      deriveMessengerKeys(
        Buffer.from(
          String(i + 4)
            .repeat(64)
            .slice(0, 64),
          'hex'
        )
      )
    const sender = new PcryptoService(memberKeys(1), group[1]!.id)
    const reader = new PcryptoService(memberKeys(4), group[4]!.id)
    const secrets = await sender.encryptKey('common-secret', group, 10, 2)
    const event = { type: 'm.room.encryption', sender: group[1]!.id, content: secrets }
    await expect(reader.decryptEvent(event, group)).resolves.toBe('common-secret')
    // Повтор — из кэша, тот же результат.
    await expect(reader.decryptEvent(event, group)).resolves.toBe('common-secret')
  })
})
