// Прогноз буста — формула старого клиента (components/pkoin): вероятность
// попасть в первые 30 постов ленты языка = 3 × (буст поста + добавка) /
// бусты остальных, не больше 1; и обратно — сколько добавить до цели.

import { describe, expect, it } from 'vitest'
import {
  boostAmountFor,
  boostProbability,
  boostShares,
  isBoostSlot,
  pickBoosted,
  type BoostStanding,
} from './boost'

const POST = 'p'.repeat(64)
const PKOIN = 100_000_000

/** Лента языка: у других постов 30 PKOIN на двоих, у нашего — `own`. */
function feed(own = 0): BoostStanding[] {
  const list: BoostStanding[] = [
    { txid: 'a'.repeat(64), boost: 20 * PKOIN },
    { txid: 'b'.repeat(64), boost: 10 * PKOIN },
  ]
  if (own) list.push({ txid: POST, boost: own * PKOIN })
  return list
}

describe('boostShares', () => {
  it('разделяет буст поста и остальных; мусор в суммах не считается', () => {
    expect(boostShares(feed(4), POST)).toEqual({ own: 4 * PKOIN, others: 30 * PKOIN })
    expect(boostShares([...feed(), { txid: 'c'.repeat(64), boost: Number.NaN }], POST).others).toBe(
      30 * PKOIN
    )
  })
})

describe('boostProbability', () => {
  it('3 × сумма / бусты остальных: 2,5 из 30 — это 25 %', () => {
    expect(boostProbability(feed(), POST, 2.5)).toBeCloseTo(0.25)
    expect(boostProbability(feed(), POST, 5)).toBeCloseTo(0.5)
  })

  it('уже набранный буст поста складывается с добавкой', () => {
    expect(boostProbability(feed(2.5), POST, 2.5)).toBeCloseTo(0.5)
  })

  it('больше 100 % не бывает', () => {
    expect(boostProbability(feed(), POST, 50)).toBe(1)
  })

  it('других бустов нет — любая сумма даёт 100 %', () => {
    expect(boostProbability([], POST, 2.5)).toBe(1)
    expect(boostProbability([{ txid: POST, boost: PKOIN }], POST, 0)).toBe(1)
  })

  it('без добавки и без своего буста — 0 %', () => {
    expect(boostProbability(feed(), POST, 0)).toBe(0)
    expect(boostProbability(feed(), POST, Number.NaN)).toBe(0)
  })
})

describe('boostAmountFor', () => {
  it('до 100 % при 30 PKOIN у остальных — 10 PKOIN', () => {
    expect(boostAmountFor(feed(), POST, 1)).toBe(10)
    expect(boostAmountFor(feed(), POST, 0.5)).toBe(5)
  })

  it('набранный буст вычитается; цель уже достигнута — 0', () => {
    expect(boostAmountFor(feed(4), POST, 1)).toBe(6)
    expect(boostAmountFor(feed(12), POST, 1)).toBe(0)
    expect(boostAmountFor([], POST, 1)).toBe(0)
  })

  it('округляет вверх до сотых, без хвостов плавающей точки', () => {
    // 10 PKOIN у остальных: для 100 % нужно 3,333… — берём 3,34.
    expect(boostAmountFor([{ txid: 'a'.repeat(64), boost: 10 * PKOIN }], POST, 1)).toBe(3.34)
    // 6,9 PKOIN: ровно 2,3, а не 2,31 из-за 2,3 × 100 = 230,000…03.
    expect(boostAmountFor([{ txid: 'a'.repeat(64), boost: 690_000_000 }], POST, 1)).toBe(2.3)
  })
})

describe('места продвигаемых постов', () => {
  it('после 5-го, 14-го и 28-го поста, как у старого клиента, дальше — через десять', () => {
    const slots = Array.from({ length: 60 }, (_, i) => i).filter(isBoostSlot)
    expect(slots).toEqual([5, 14, 28, 38, 48, 58])
  })
})

describe('выбор продвигаемых постов', () => {
  const boosts = [
    { txid: 'a', boost: 30 * PKOIN },
    { txid: 'b', boost: 10 * PKOIN },
    { txid: 'c', boost: 0 },
    { txid: 'd' },
  ]

  it('шанс — по сумме буста: из 30 и 10 PKOIN первый выпадает в три раза чаще', () => {
    // random() < 0,75 попадает в долю поста на 30 PKOIN (30 из 40).
    expect(pickBoosted(boosts, 1, () => 0.74)[0]?.txid).toBe('a')
    expect(pickBoosted(boosts, 1, () => 0.76)[0]?.txid).toBe('b')
  })

  it('без повторов и без постов без суммы', () => {
    expect(pickBoosted(boosts, 5, () => 0).map((b) => b.txid)).toEqual(['a', 'b'])
    expect(pickBoosted(boosts, 5, () => 0.99).map((b) => b.txid)).toEqual(['b', 'a'])
  })

  it('частоты сходятся с прогнозом окна буста', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    let first = 0
    for (let i = 0; i < 4000; i++) if (pickBoosted(boosts, 1, random)[0]?.txid === 'a') first++
    expect(first / 4000).toBeGreaterThan(0.72)
    expect(first / 4000).toBeLessThan(0.78)
  })
})
