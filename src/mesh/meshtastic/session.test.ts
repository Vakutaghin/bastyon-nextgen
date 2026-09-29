import { describe, expect, it, vi } from 'vitest'

import { toHex } from '../bytes'
import { REGION_UNSET } from './constants'
import { decodeChannelUrl } from './codec'
import { randomPsk } from './channels'
import { hopsOf, MeshtasticSession, type MtIncoming, type MtSendUpdate } from './session'
import { FakeMeshAir, FakeMeshtasticDevice } from './testing/fake-device'

const FAST = {
  keyWaitMs: 200,
  ackTimeoutMs: 2_000,
  channelTimeoutMs: 2_000,
  adminTimeoutMs: 500,
  textSpacingMs: 0,
  relayedWaitMs: 150,
  setClock: false,
}

function world() {
  const air = new FakeMeshAir()
  const alice = new FakeMeshtasticDevice(air, { longName: 'Alice' })
  const bob = new FakeMeshtasticDevice(air, { longName: 'Bob' })
  return { air, alice, bob }
}

async function open(device: FakeMeshtasticDevice, opts: Partial<typeof FAST> = {}) {
  const s = MeshtasticSession.create(device.connect(), { ...FAST, ...opts })
  const inbox: MtIncoming[] = []
  s.on('message', (m) => inbox.push(m))
  await s.start()
  return { s, inbox }
}

function tracker() {
  const updates: MtSendUpdate[] = []
  const ids: number[] = []
  return {
    updates,
    ids,
    // Id пакета проверяется отдельно: в статусах важен смысл.
    onUpdate: ({ packetId, ...u }: MtSendUpdate) => {
      if (packetId !== undefined) ids.push(packetId)
      updates.push(u)
    },
    last: () => updates[updates.length - 1],
  }
}

describe('meshtastic session: handshake', () => {
  it('learns its own node, the known nodes and the channels', async () => {
    const { alice, bob } = world()
    alice.learn(bob)
    const { s } = await open(alice)
    expect(s.self.longName).toBe('Alice')
    expect(s.self.id).toBe(`!${alice.nodeNum.toString(16).padStart(8, '0')}`)
    expect(s.self.publicKey).toBe(toHex(alice.user.publicKey))
    expect(s.nodeName(bob.nodeNum)).toBe('Bob')
    expect(s.channels.map((c) => [c.index, c.name, c.kind])).toEqual([[0, 'LongFast', 'public']])
    expect(s.regionUnset).toBe(false)
    expect(s.metadata?.firmwareVersion).toBe('2.7.26.54e0d8d')
  })

  it('reports an unset region: such a radio does not transmit', async () => {
    const air = new FakeMeshAir()
    const fresh = new FakeMeshtasticDevice(air, { longName: 'New', region: REGION_UNSET })
    const { s } = await open(fresh)
    expect(s.regionUnset).toBe(true)
  })

  it('hands over messages the radio kept while nobody was connected', async () => {
    const { alice, bob } = world()
    alice.learn(bob)
    bob.learn(alice)
    bob.sendTextFromHere(alice.nodeNum, 'пока тебя не было')
    const { inbox } = await open(alice)
    await vi.waitFor(() => expect(inbox.map((m) => m.text)).toEqual(['пока тебя не было']))
    expect(inbox[0]).toMatchObject({
      kind: 'direct',
      pki: true,
      from: bob.nodeNum,
      fromName: 'Bob',
    })
  })
})

describe('meshtastic session: direct messages', () => {
  it('sends with PKI to a node whose key it knows and gets the recipient ACK', async () => {
    const { alice, bob } = world()
    alice.learn(bob)
    bob.learn(alice)
    const { s } = await open(alice)
    const bobSession = await open(bob)
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'привет, Боб', t.onUpdate)
    await vi.waitFor(() => expect(t.last()?.status).toBe('delivered'))
    expect(t.updates[0]?.status).toBe('sent')
    await vi.waitFor(() => expect(bobSession.inbox).toHaveLength(1))
    expect(bobSession.inbox[0]).toMatchObject({ kind: 'direct', pki: true, text: 'привет, Боб' })
    // Флаг PKI клиент не ставит: шифрованием ведает прошивка.
    const sent = alice.received.find((m) => m.payloadVariant.case === 'packet')
    expect(sent?.payloadVariant.case === 'packet' && sent.payloadVariant.value.pkiEncrypted).toBe(
      false
    )
  })

  it('asks an unknown node for its key before the first message', async () => {
    const { alice, bob } = world()
    alice.hearOf(bob.nodeNum) // слышали номер, но не NodeInfo
    const { s } = await open(alice)
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'кто ты?', t.onUpdate)
    await vi.waitFor(() => expect(t.last()?.status).toBe('delivered'))
    expect(s.node(bob.nodeNum)?.user?.publicKey).toBe(toHex(bob.user.publicKey))
    expect(s.nodeName(bob.nodeNum)).toBe('Bob')
  })

  it('hands the radio a key the app already knows, without asking the node', async () => {
    const { alice, bob } = world()
    bob.learn(alice)
    bob.nodeInfoThrottled = true // узел не ответил бы на просьбу
    const { s } = await open(alice)
    const bobSession = await open(bob)
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'ключ из приложения', t.onUpdate, {
      peer: { publicKey: toHex(bob.user.publicKey), longName: 'Bob' },
    })
    await vi.waitFor(() => expect(t.last()?.status).toBe('delivered'))
    expect(alice.nodeDb.get(bob.nodeNum)?.isFavorite).toBe(true)
    await vi.waitFor(() =>
      expect(bobSession.inbox.map((m) => m.text)).toEqual(['ключ из приложения'])
    )
  })

  it('fails with no_key when the node does not share its key in time', async () => {
    const { alice, bob } = world()
    alice.hearOf(bob.nodeNum)
    bob.nodeInfoThrottled = true
    const { s } = await open(alice)
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'ау', t.onUpdate)
    await vi.waitFor(() => expect(t.last()).toEqual({ status: 'failed', error: 'no_key' }))
  })

  it('fails with no_ack when nobody answers', async () => {
    const { alice, bob } = world()
    alice.learn(bob)
    const { s, inbox } = await open(alice)
    bob.lora.region = REGION_UNSET // Боб не слышит
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'ты тут?', t.onUpdate)
    await vi.waitFor(() => expect(t.last()).toEqual({ status: 'failed', error: 'no_ack' }))
    expect(inbox).toHaveLength(0)
  })

  it('receives a direct message with its hops, reply and reaction markers', async () => {
    const { alice, bob } = world()
    alice.learn(bob)
    bob.learn(alice)
    const { inbox } = await open(alice)
    const first = bob.sendTextFromHere(alice.nodeNum, 'вопрос')
    bob.sendTextFromHere(alice.nodeNum, 'ответ', { replyId: first })
    bob.sendTextFromHere(alice.nodeNum, '👍', { replyId: first, emoji: true })
    await vi.waitFor(() => expect(inbox).toHaveLength(3))
    expect(inbox[0]).toMatchObject({ text: 'вопрос', hops: 0, replyId: null, reaction: false })
    expect(inbox[1]).toMatchObject({ text: 'ответ', replyId: first, reaction: false })
    expect(inbox[2]).toMatchObject({ text: '👍', replyId: first, reaction: true })
  })
})

describe('meshtastic session: firmware limits', () => {
  it('spaces texts out: the firmware drops more than one per two seconds', async () => {
    const { alice, bob } = world()
    alice.rateLimitMs = 100
    const { s } = await open(alice, { textSpacingMs: 120 })
    const bobSession = await open(bob)
    const t = [tracker(), tracker(), tracker()]
    await Promise.all(
      t.map((x, i) => s.sendText({ kind: 'channel', index: 0 }, `часть ${i}`, x.onUpdate))
    )
    await vi.waitFor(() => expect(bobSession.inbox).toHaveLength(3))
    for (const x of t) await vi.waitFor(() => expect(x.last()?.status).toBe('delivered'))
  })

  it('resends a text the firmware dropped for the rate limit, under a new id', async () => {
    const { alice, bob } = world()
    alice.rateLimitMs = 100
    const { s } = await open(alice, { textSpacingMs: 60 })
    const bobSession = await open(bob)
    const first = tracker()
    const second = tracker()
    await s.sendText({ kind: 'channel', index: 0 }, 'раз', first.onUpdate)
    const firstTry = await s.sendText({ kind: 'channel', index: 0 }, 'два', second.onUpdate)
    await vi.waitFor(() => expect(second.last()?.status).toBe('delivered'))
    expect(second.ids[second.ids.length - 1]).not.toBe(firstTry)
    await vi.waitFor(() => expect(bobSession.inbox.map((m) => m.text)).toEqual(['раз', 'два']))
  })

  it('gives up on the rate limit after three resends', async () => {
    const { alice } = world()
    alice.rateLimitMs = 10_000
    const { s } = await open(alice)
    const first = tracker()
    const second = tracker()
    await s.sendText({ kind: 'channel', index: 0 }, 'раз', first.onUpdate)
    await s.sendText({ kind: 'channel', index: 0 }, 'два', second.onUpdate)
    await vi.waitFor(() => expect(second.last()).toEqual({ status: 'failed', error: 'air_limit' }))
  })

  it('reports a radio without a region as switched off', async () => {
    const air = new FakeMeshAir()
    const fresh = new FakeMeshtasticDevice(air, { longName: 'New', region: REGION_UNSET })
    const { s } = await open(fresh)
    const t = tracker()
    await s.sendText({ kind: 'channel', index: 0 }, 'алло', t.onUpdate)
    await vi.waitFor(() => expect(t.last()).toEqual({ status: 'failed', error: 'radio_off' }), {
      timeout: 3_000,
    })
  })

  it('treats a relayed direct message as sent when no ACK follows', async () => {
    const { air, alice, bob } = world()
    const carol = new FakeMeshtasticDevice(air, { longName: 'Carol' })
    carol.relays = true
    alice.learn(bob)
    bob.lora.region = REGION_UNSET // Боба не слышно, но Кэрол ретранслирует
    const { s } = await open(alice)
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'через Кэрол', t.onUpdate)
    await vi.waitFor(() => expect(t.updates).toContainEqual({ status: 'sent', relayed: true }))
    await vi.waitFor(() => expect(t.last()).toEqual({ status: 'sent', relayed: true }))
    expect(t.updates.some((u) => u.status === 'failed')).toBe(false)
  })

  it('sets the radio clock after connecting', async () => {
    const { alice } = world()
    await open(alice, { setClock: true })
    await vi.waitFor(() => expect(alice.clock).toBeGreaterThan(1_700_000_000))
  })

  it('treats an empty key on an extra channel as the primary key', async () => {
    const { alice } = world()
    alice.setChannel(1, 'Team', new Uint8Array(0))
    const { s } = await open(alice)
    const team = s.channels.find((c) => c.index === 1)
    expect(team).toMatchObject({ name: 'Team', kind: 'public', unencrypted: false })
  })
})

describe('meshtastic session: channels', () => {
  it('sends to the primary channel and counts a relay as delivery', async () => {
    const { alice, bob } = world()
    const { s } = await open(alice)
    const bobSession = await open(bob)
    const t = tracker()
    await s.sendText({ kind: 'channel', index: 0 }, 'всем привет', t.onUpdate)
    await vi.waitFor(() => expect(t.last()?.status).toBe('delivered'))
    await vi.waitFor(() => expect(bobSession.inbox.map((m) => m.text)).toEqual(['всем привет']))
    const got = bobSession.inbox[0]!
    expect(got.kind === 'channel' && got.channel.name).toBe('LongFast')
    expect(got.fromName).toBeNull() // имени Алисы Боб ещё не знает
  })

  it('keeps a channel message as sent when nobody relayed it', async () => {
    const { alice, bob } = world()
    bob.lora.region = REGION_UNSET
    const { s } = await open(alice)
    const t = tracker()
    await s.sendText({ kind: 'channel', index: 0 }, 'эхо', t.onUpdate)
    await vi.waitFor(() => expect(t.last()).toEqual({ status: 'sent' }))
  })

  it('adds a private channel, shares it as a link and removes it', async () => {
    const { alice, bob } = world()
    const { s } = await open(alice)
    const psk = randomPsk()
    const index = await s.addChannel('Family', psk)
    expect(index).toBe(1)
    expect(s.channels.map((c) => [c.index, c.name, c.kind])).toEqual([
      [0, 'LongFast', 'public'],
      [1, 'Family', 'private'],
    ])
    const url = s.channelUrl(1)!
    const share = decodeChannelUrl(url)
    expect(toHex(share!.channels[0]!.psk)).toBe(toHex(psk))

    // Боб добавляет канал по ссылке — и они слышат друг друга в нём.
    const bobSession = await open(bob)
    expect(await bobSession.s.importChannels(share!)).toEqual([1])
    expect(await bobSession.s.importChannels(share!)).toEqual([]) // второй раз — не дублирует
    const t = tracker()
    await s.sendText({ kind: 'channel', index: 1 }, 'только своим', t.onUpdate)
    await vi.waitFor(() =>
      expect(bobSession.inbox.map((m) => (m.kind === 'channel' ? m.channel.name : '?'))).toEqual([
        'Family',
      ])
    )

    await s.removeChannel(1)
    expect(s.channels.map((c) => c.index)).toEqual([0])
    await expect(s.removeChannel(0)).rejects.toMatchObject({ message: 'primary_channel' })
  })
})

describe('meshtastic session: radio settings', () => {
  it('renames the node', async () => {
    const { alice } = world()
    const { s } = await open(alice)
    await s.setOwner('Алиса', 'Али')
    expect(s.self.longName).toBe('Алиса')
    expect(alice.user.longName).toBe('Алиса')
    expect(await s.fetchOwner()).toBe('Алиса')
  })

  it('sets the region; the radio reboots and the session closes', async () => {
    const air = new FakeMeshAir()
    const fresh = new FakeMeshtasticDevice(air, { longName: 'New', region: REGION_UNSET })
    const { s } = await open(fresh)
    const closed = vi.fn()
    s.on('closed', closed)
    expect(await s.setLoRa({ region: 9 })).toBe(true)
    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith('device_lost'))
    expect(fresh.lora.region).toBe(9)
    expect(fresh.reboots).toBe(1)
  })

  it('leaves an unfinished message as sent when the link drops', async () => {
    const { air, alice, bob } = world()
    alice.learn(bob)
    bob.learn(alice)
    const { s } = await open(alice)
    air.dropAcks = true // Боб получил, но подтверждение потерялось
    const t = tracker()
    await s.sendText({ kind: 'direct', num: bob.nodeNum }, 'на обрыв', t.onUpdate)
    await vi.waitFor(() => expect(t.updates[0]?.status).toBe('sent'))
    alice.drop()
    await vi.waitFor(() => expect(s.isClosed).toBe(true))
    expect(t.last()).toEqual({ status: 'sent' })
  })
})

describe('hops', () => {
  it('counts hops from hop_start and hop_limit', () => {
    expect(hopsOf({ hopStart: 3, hopLimit: 1 })).toBe(2)
    expect(hopsOf({ hopStart: 0, hopLimit: 0 })).toBeNull()
  })
})
