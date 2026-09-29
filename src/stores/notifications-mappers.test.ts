import { describe, it, expect } from 'vitest'
import {
  canonicalStoredMesType,
  mapMissedEventToNotification,
  MIN_TRANSFER_NOTIFY_PKOIN,
  opReturnText,
} from './notifications-mappers'

// Покрывает live-маппер, который использует notifications-store
// (не путать с дублёром в notifications-store-helpers.ts).
describe('mapMissedEventToNotification — донат/tip', () => {
  it('маппит полученную транзакцию (msg:transaction + amount) в уведомление tip', () => {
    const r = mapMissedEventToNotification({
      txid: 'tx1',
      time: 1_700_000_000,
      amount: '200000000', // 2 PKOIN в сатоши
      nout: '1',
      msg: 'transaction',
      nblock: 100,
    })
    expect(r).not.toBeNull()
    expect(r!.type).toBe('tip')
    expect(r!.title).toBe('notif.titleTip')
    expect(r!.description).toBe('+2 PKOIN')
    expect(r!.id).toBe('tx1')
  })

  it('распознаёт tip и по mesType:transaction', () => {
    const r = mapMissedEventToNotification({
      txid: 'tx2',
      mesType: 'transaction',
      amount: 50_000_000, // 0.5 PKOIN
      nblock: 1,
    })
    expect(r!.type).toBe('tip')
    expect(r!.description).toBe('+0.5 PKOIN')
  })

  it('транзакция без amount не считается tip', () => {
    const r = mapMissedEventToNotification({ txid: 'tx3', msg: 'transaction', nblock: 1 })
    expect(r!.type).not.toBe('tip')
  })

  it('отбрасывает сырые блокчейн-транзакции без mesType/msg (регистрация/пополнение)', () => {
    // Так выглядят элементы getmissedinfo для свежего аккаунта: числовой type,
    // height/nTime/s1/vin — но НЕ уведомление. Должны отсеиваться (→ null),
    // иначе в выпадашке появляется «Кто-то · Уведомление» без деталей.
    const registration = mapMissedEventToNotification({
      txid: '357cd6fb',
      type: 100,
      height: 3891369,
      nTime: 1782209358,
      s1: 'PRxP5HytUeMHQd9UEcyW1bg1ouuSdCkqvf',
      vin: [{ txid: 'x', vout: 210 }],
    })
    expect(registration).toBeNull()

    const funding = mapMissedEventToNotification({
      txid: '4083f758',
      type: 1,
      height: 3891332,
      vin: [{ address: 'PDUJ', value: 67 }],
      vout: [{ n: 0, value: 0.00002 }],
    })
    expect(funding).toBeNull()
  })

  it('обычные события сохраняют прежний маппинг', () => {
    const sub = mapMissedEventToNotification({ txid: 's', mesType: 'subscribe', nblock: 1 })
    expect(sub!.type).toBe('subscribe')
    expect(sub!.title).toBe('notif.titleSubscribe')

    const rate = mapMissedEventToNotification({
      txid: 'u',
      mesType: 'upvoteShare',
      upvoteVal: 5,
      nblock: 1,
    })
    expect(rate!.type).toBe('rating')
  })
})

// События в том виде, в каком их присылает нода (pocketnet.core 0.22,
// GetMissedInfo в WebSocketRpc.cpp).
describe('mapMissedEventToNotification — события ноды', () => {
  it('msg:comment + mesType:post — комментарий к вашему посту, а не «новый пост»', () => {
    const r = mapMissedEventToNotification({
      addr: 'ME',
      msg: 'comment',
      mesType: 'post',
      reason: 'post',
      txid: 'c1',
      time: 10,
      nblock: 5,
      addrFrom: 'PA',
      posttxid: 'p1',
    })
    expect(r).toMatchObject({
      type: 'comment',
      mesType: 'comment',
      title: 'notif.titleComment',
      shareId: 'p1',
      from: 'PA',
    })
  })

  it('ответ на комментарий остаётся ответом', () => {
    const r = mapMissedEventToNotification({
      msg: 'comment',
      mesType: 'answer',
      txid: 'c2',
      nblock: 5,
      posttxid: 'p1',
      addrFrom: 'PA',
    })
    expect(r).toMatchObject({ type: 'comment', mesType: 'answer', title: 'notif.titleAnswer' })
  })

  it('cScore — оценка комментария: знает комментарий, пост найдётся через него', () => {
    const r = mapMissedEventToNotification({
      msg: 'event',
      mesType: 'cScore',
      txid: 's1',
      commentid: 'c1',
      upvoteVal: -1,
      nblock: 5,
      addrFrom: 'PA',
    })
    expect(r).toMatchObject({
      type: 'rating',
      mesType: 'upvoteComment',
      title: 'notif.titleCommentScore',
      commentId: 'c1',
      upvoteVal: -1,
    })
    expect(r!.shareId).toBeUndefined()
  })

  it('reshare — репост: открывается сам репост', () => {
    const r = mapMissedEventToNotification({
      msg: 'reshare',
      txid: 'r1',
      txidRepost: 'p1',
      addrFrom: 'PA',
      nblock: 5,
    })
    expect(r).toMatchObject({
      type: 'repost',
      mesType: 'repost',
      title: 'notif.titleRepost',
      shareId: 'r1',
    })
  })

  it('contentBoost — буст поста, имя автора приходит в событии', () => {
    const r = mapMissedEventToNotification({
      msg: 'event',
      mesType: 'contentBoost',
      txid: 'b1',
      posttxid: 'p1',
      boostAmount: 100000000,
      addrFrom: 'PA',
      nameFrom: 'alice',
      avatarFrom: 'https://img/a.jpg',
      nblock: 5,
    })
    expect(r).toMatchObject({ mesType: 'boost', title: 'notif.titleBoost', shareId: 'p1' })
    expect(r!.fromSnapshot).toMatchObject({ address: 'PA', name: 'alice' })
  })

  it('postfromprivate — новый пост автора с колокольчиком', () => {
    const r = mapMissedEventToNotification({
      msg: 'event',
      mesType: 'postfromprivate',
      txid: 'np1',
      addrFrom: 'PB',
      nameFrom: 'bob',
      postsCnt: 2,
      nblock: 5,
    })
    expect(r).toMatchObject({
      mesType: 'postfromprivate',
      title: 'notif.titlePost',
      shareId: 'np1',
      from: 'PB',
    })
  })
})

describe('mapMissedEventToNotification — входящие монеты из сырых транзакций', () => {
  const vout = (address: string, value: number, n = 0) => ({
    n,
    value,
    scriptPubKey: { addresses: [address] },
  })

  it('перевод от другого человека — уведомление с суммой и отправителем', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 't1',
        type: 1,
        height: 120,
        nTime: 1_700_000_000,
        vin: [{ txid: 'x', vout: 0, address: 'PX', value: 3 }],
        vout: [vout('ME', 2), vout('PX', 0.99999999, 1)],
      },
      'ME'
    )
    expect(r).toMatchObject({
      id: 't1',
      nblock: 120,
      type: 'tip',
      mesType: 'transaction',
      title: 'notif.titleTip',
      description: '+2 PKOIN',
      from: 'PX',
    })
  })

  it('сдача своей транзакции (первый вход наш) — не уведомление', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 't2',
        type: 204,
        height: 120,
        vin: [{ address: 'ME', value: 1 }],
        vout: [vout('ME', 0.99999999)],
      },
      'ME'
    )
    expect(r).toBeNull()
  })

  it('перевод меньше порога — не уведомление', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 't3',
        type: 1,
        height: 120,
        vin: [{ address: 'PX' }],
        vout: [vout('ME', MIN_TRANSFER_NOTIFY_PKOIN / 2)],
      },
      'ME'
    )
    expect(r).toBeNull()
  })

  it('coinstake с выходом на наш адрес — награда из лотереи', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 't4',
        type: 3,
        height: 121,
        vin: [{ address: 'STAKER' }],
        vout: [vout('STAKER', 50), vout('ME', 0.5, 1)],
      },
      'ME'
    )
    expect(r).toMatchObject({
      type: 'other',
      mesType: 'win',
      title: 'notif.titleWin',
      description: '+0.5 PKOIN',
    })
    expect(r!.from).toBeUndefined()
  })
})

describe('чаевые и сообщение перевода — из OP_RETURN', () => {
  const opReturn = (text: string) => {
    const hex = Buffer.from(text, 'utf8').toString('hex')
    return {
      n: 0,
      value: 0,
      scriptPubKey: {
        addresses: [''],
        hex: `6a${(hex.length / 2).toString(16).padStart(2, '0')}${hex}`,
      },
    }
  }
  const pay = (address: string, value: number, n = 1) => ({
    n,
    value,
    scriptPubKey: { addresses: [address], hex: '76a914' },
  })

  it('opReturnText читает первый push как текст', () => {
    expect(opReturnText(opReturn('a:donate').scriptPubKey.hex)).toBe('a:donate')
    expect(opReturnText('76a914abcdef')).toBeUndefined()
  })

  it('метка a:donate — это чаевые', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 'd1',
        type: 1,
        height: 130,
        vin: [{ address: 'PX' }],
        vout: [opReturn('a:donate'), pay('ME', 5)],
      },
      'ME'
    )
    expect(r).toMatchObject({
      type: 'tip',
      mesType: 'donation',
      title: 'notif.titleDonation',
      description: '+5 PKOIN',
    })
  })

  it('сообщение обычного перевода видно в уведомлении', () => {
    const r = mapMissedEventToNotification(
      {
        txid: 'm1',
        type: 1,
        height: 130,
        vin: [{ address: 'PX' }],
        vout: [opReturn('За кофе'), pay('ME', 1)],
      },
      'ME'
    )
    expect(r).toMatchObject({ mesType: 'transaction', description: '+1 PKOIN · За кофе' })
  })
})

describe('canonicalStoredMesType', () => {
  it('переводит имена ноды из старых записей IDB', () => {
    expect(canonicalStoredMesType('post')).toBe('comment')
    expect(canonicalStoredMesType('cScore')).toBe('upvoteComment')
    expect(canonicalStoredMesType('contentBoost')).toBe('boost')
    expect(canonicalStoredMesType('postfromprivate')).toBe('postfromprivate')
    expect(canonicalStoredMesType(undefined)).toBeUndefined()
  })
})
