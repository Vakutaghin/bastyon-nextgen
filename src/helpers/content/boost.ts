/**
 * Продвижение (буст) поста за PKOIN: сколько стоит и чего ждать.
 *
 * Нода собирает ленту бустов по языку поста за последние 1440 блоков (около
 * суток) и отдаёт сумму бустов каждого поста (`getboostfeed`). Приложение,
 * как старый клиент (`randomizerarray` в satolist.js), выбирает продвигаемые
 * посты случайно, с шансом по сумме буста (`pickBoosted`), и ставит их после
 * 5-го, 14-го и 28-го поста ленты, дальше — после каждого десятого
 * (`isBoostSlot`). Три места в первых 30 постах и дают формулу прогноза ниже.
 *
 * Прогноз — формула старого клиента (components/pkoin): вероятность попасть
 * в первые 30 постов ленты своего языка примерно на сутки равна
 * 3 × (буст поста + добавка) / сумма бустов остальных постов, но не больше 1.
 * Других бустов нет — любая сумма даёт 100 %.
 */

import { AMOUNT_MULTIPLIER, toSatoshis } from '@/blockchain/constants/transactions'

/** Меньше старый клиент не отправлял; сама нода минимума не проверяет. */
export const BOOST_MIN_PKOIN = 2.5

/** Сколько первых постов ленты берёт прогноз. */
export const BOOST_TOP_POSTS = 30

/** Буст одного поста в ленте языка: txid и сумма в сатоши. */
export interface BoostStanding {
  txid: string
  boost: number
}

/** Буст самого поста и сумма бустов остальных постов языка, в сатоши. */
export function boostShares(
  standings: readonly BoostStanding[],
  postId: string
): { own: number; others: number } {
  let own = 0
  let others = 0
  for (const s of standings) {
    const boost = Number.isFinite(s.boost) && s.boost > 0 ? s.boost : 0
    if (s.txid === postId) own += boost
    else others += boost
  }
  return { own, others }
}

/** Вероятность (0…1) попасть в первые 30 постов, если добавить `addPkoin`. */
export function boostProbability(
  standings: readonly BoostStanding[],
  postId: string,
  addPkoin: number
): number {
  const { own, others } = boostShares(standings, postId)
  if (!others) return 1
  const added = Number.isFinite(addPkoin) && addPkoin > 0 ? toSatoshis(addPkoin) : 0
  return Math.min((3 * (own + added)) / others, 1)
}

/**
 * Сколько PKOIN добавить, чтобы вероятность стала `target` (0…1): с учётом уже
 * набранного буста, вверх до сотых, чтобы округление не недобрало. 0 — уже так.
 */
export function boostAmountFor(
  standings: readonly BoostStanding[],
  postId: string,
  target: number
): number {
  const { own, others } = boostShares(standings, postId)
  if (!others) return 0
  const needed = (Math.min(Math.max(target, 0), 1) * others) / 3 - own
  if (needed <= 0) return 0
  // Сотые доли PKOIN считаем в целых сатоши: в дробях PKOIN 2,3 × 100 даёт 230,000…03.
  const hundredth = AMOUNT_MULTIPLIER / 100
  return Math.ceil(Math.round(needed) / hundredth) / 100
}

/** После скольких обычных постов встают первые продвигаемые (старый клиент: 4, 13, 27 по индексу). */
const FIRST_BOOST_SLOTS: readonly number[] = [5, 14, 28]
const LAST_FIRST_SLOT = 28
/** Дальше — по одному после каждых стольких постов. */
const BOOST_SLOT_STEP = 10

/** Встаёт ли продвигаемый пост после `postsBefore` обычных постов ленты. */
export function isBoostSlot(postsBefore: number): boolean {
  if (postsBefore <= LAST_FIRST_SLOT) return FIRST_BOOST_SLOTS.includes(postsBefore)
  return (postsBefore - LAST_FIRST_SLOT) % BOOST_SLOT_STEP === 0
}

/**
 * До `count` постов из ленты бустов — случайно, с шансом по сумме буста, без
 * повторов: пост с вдвое большим бустом попадается вдвое чаще, но и малые
 * бусты иногда показываются. Посты без суммы не берутся.
 */
export function pickBoosted<T extends { boost?: number }>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const pool = items.filter((b) => Number.isFinite(b.boost) && (b.boost ?? 0) > 0)
  const picked: T[] = []
  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, b) => sum + (b.boost ?? 0), 0)
    let r = random() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i]!.boost ?? 0
      if (r < 0) {
        index = i
        break
      }
    }
    picked.push(pool.splice(index, 1)[0]!)
  }
  return picked
}
