import { describe, it, expect } from 'vitest'
import { mapMissedEventToNotification } from './notifications-mappers'

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
