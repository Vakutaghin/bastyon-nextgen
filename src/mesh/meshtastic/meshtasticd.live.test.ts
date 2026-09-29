/**
 * Сеанс против настоящей прошивки: два узла meshtasticd в режиме симуляции,
 * связанные UDP multicast. Обычный прогон тестов это пропускает.
 *
 * Запуск (регион RU и UDP на узлах задаются один раз, см. MANUAL_CHECKS.md,
 * раздел «Mesh-радио»):
 *   docker network create bst-mesh
 *   docker run -d --name bst-mt1 --network bst-mesh -p 127.0.0.1:44031:4403 \
 *     meshtastic/meshtasticd:2.7.26-alpine meshtasticd -s -d /tmp/mt -h 02:11:22:33:44:01
 *   (так же bst-mt2 на 44032 с -h …:02)
 *   MESHTASTICD=127.0.0.1:44031,127.0.0.1:44032 npx vitest run meshtasticd.live
 *
 * Прошивка отвечает на обмен NodeInfo не чаще раза в 10 минут после старта —
 * узлам нужно проработать 10 минут, иначе ЛС упрётся в no_key.
 */

import net from 'node:net'
import { describe, expect, it } from 'vitest'

import type { ByteLink, CloseReason } from '../radio/types'
import { randomPsk } from './channels'
import { decodeChannelUrl } from './codec'
import { packetLinkFromStream } from './framing'
import { MeshtasticSession, type MtIncoming, type MtPeer, type MtSendUpdate } from './session'

const nodes = (process.env.MESHTASTICD ?? '').split(',').filter(Boolean)

function tcpLink(address: string): Promise<ByteLink> {
  const [host, port] = address.split(':')
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(port), host!)
    const closeCbs = new Set<(r: CloseReason) => void>()
    sock.once('error', reject)
    sock.on('close', () => closeCbs.forEach((cb) => cb('device_lost')))
    sock.once('connect', () =>
      resolve({
        kind: 'tcp',
        label: address,
        write: (d) => new Promise<void>((res, rej) => sock.write(d, (e) => (e ? rej(e) : res()))),
        onData(cb) {
          const h = (b: Buffer) => cb(new Uint8Array(b))
          sock.on('data', h)
          return () => sock.off('data', h)
        },
        onClose(cb) {
          closeCbs.add(cb)
          return () => closeCbs.delete(cb)
        },
        close: async () => {
          sock.end()
        },
      })
    )
  })
}

async function session(address: string) {
  const s = MeshtasticSession.create(packetLinkFromStream(await tcpLink(address)), {
    keyWaitMs: 30_000,
  })
  const inbox: MtIncoming[] = []
  s.on('message', (m) => inbox.push(m))
  await s.start()
  return { s, inbox }
}

function send(
  s: MeshtasticSession,
  target: Parameters<MeshtasticSession['sendText']>[0],
  text: string,
  peer?: MtPeer
) {
  return new Promise<MtSendUpdate[]>((resolve) => {
    const updates: MtSendUpdate[] = []
    void s.sendText(
      target,
      text,
      (u) => {
        updates.push(u)
        // Итог: доставлено, ошибка или второй «ушло» (радио сообщило, что всё).
        if (u.status !== 'sent' || updates.length > 1) resolve(updates)
      },
      { peer }
    )
    setTimeout(() => resolve(updates), 60_000)
  })
}

async function until(check: () => boolean, ms = 60_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 200))
  }
}

describe.skipIf(nodes.length < 2)('meshtasticd 2.7 (live)', () => {
  it('talks to real firmware: handshake, channel, direct message, settings', async () => {
    const a = await session(nodes[0]!)
    const b = await session(nodes[1]!)
    try {
      expect(a.s.self.nodeNum).toBeGreaterThan(0)
      expect(a.s.metadata?.firmwareVersion).toMatch(/^2\.7\./)
      expect(a.s.regionUnset).toBe(false)
      expect(a.s.channels[0]?.name).toBe('LongFast')

      // Канал: Боб слышит Алису.
      const tag = `канал ${Date.now()}`
      const ch = await send(a.s, { kind: 'channel', index: 0 }, tag)
      await until(() => b.inbox.some((m) => m.text === tag))
      expect(ch[0]?.status).toBe('sent')

      // ЛС: ключ Боба приложение уже знает (NodeInfo прошивка раздаёт скупо —
      // раз в 12 ч одному просящему), отдаёт его радио через add_contact.
      const dm = `лично ${Date.now()}`
      const bobKey = { publicKey: b.s.self.publicKey!, longName: b.s.self.longName }
      const updates = await send(a.s, { kind: 'direct', num: b.s.self.nodeNum }, dm, bobKey)
      expect(updates[updates.length - 1]?.status).toBe('delivered')
      await until(() => b.inbox.some((m) => m.text === dm))
      const got = b.inbox.find((m) => m.text === dm)!
      expect(got).toMatchObject({ kind: 'direct', pki: true, from: a.s.self.nodeNum })

      // Ответ в обратную сторону.
      const aliceKey = { publicKey: a.s.self.publicKey!, longName: a.s.self.longName }
      const back = await send(
        b.s,
        { kind: 'direct', num: a.s.self.nodeNum },
        `ответ ${dm}`,
        aliceKey
      )
      expect(back[back.length - 1]?.status).toBe('delivered')

      // Приватный канал: создать у Алисы, добавить Бобу по ссылке, поговорить.
      const index = await a.s.addChannel('BstTest', randomPsk())
      const share = decodeChannelUrl(a.s.channelUrl(index)!)!
      const [bIndex] = await b.s.importChannels(share)
      const secret = `секрет ${Date.now()}`
      await send(a.s, { kind: 'channel', index }, secret)
      await until(() =>
        b.inbox.some(
          (m) => m.text === secret && m.kind === 'channel' && m.channel.name === 'BstTest'
        )
      )
      await a.s.removeChannel(index)
      await b.s.removeChannel(bIndex!)

      // Настройки: имя узла через admin. Смена имени перезагружает радио через
      // 7 с (AdminModule.cpp), поэтому это последний шаг.
      const name = a.s.self.longName
      await a.s.setOwner(`${name}-x`, a.s.self.shortName)
      expect(await a.s.fetchOwner()).toBe(`${name}-x`)
      await a.s.setOwner(name, a.s.self.shortName)
    } finally {
      await a.s.close()
      await b.s.close()
    }
  }, 240_000)
})
