/**
 * Комиссия денежного перевода.
 *
 * Социальную транзакцию (пост, комментарий, оценку, профиль, регистрацию)
 * сеть принимает с комиссией в один сатоши — у них своя политика. Обычный
 * перевод (type 1) так не проходит: нода отвечает `-26`, потому что комиссия
 * ниже minRelayTxFee, и человек видел «Сеть отклонила транзакцию: -26».
 *
 * Проверено по цепочке 29.10.2026: регистрация (type 100) заплатила 1 сатоши,
 * а каждый найденный перевод (type 1) — от 1900 сатоши за килобайт. Старый
 * клиент (pocketnet.gui, actions.js) тоже считает комиссию от размера:
 * `virtualSize * max(estimatesmartfee, 0.00001)` — и переплачивает на порядки,
 * потому что множит байты на ставку за килобайт. Берём честную ставку с
 * двойным запасом: размер до подписи известен только оценкой.
 *
 * Ставку у ноды (`estimatesmartfee`) не спрашиваем: она отдаёт 4 сатоши за
 * килобайт, то есть ниже минимума релея, и всё равно пришлось бы поднимать до
 * нижней границы.
 */

import { AMOUNT_MULTIPLIER } from '../../constants/transactions'

/** Минимум релея Bitcoin-ядра, от которого форкнут pocketnet.core. */
export const MIN_RELAY_FEE_SAT_PER_KB = 1000

/** Наша ставка: двойной минимум релея. Для перевода это сотые доли копейки. */
export const TRANSFER_FEE_SAT_PER_KB = 2 * MIN_RELAY_FEE_SAT_PER_KB

/** Нижняя граница комиссии перевода, сатоши. */
export const MIN_TRANSFER_FEE_SATOSHIS = 1000

/** Предохранитель: больше этого комиссия быть не может (0.01 PKOIN). */
export const MAX_TRANSFER_FEE_SATOSHIS = 1_000_000

/** Байты сериализованной транзакции, по частям. */
const TX_OVERHEAD_BYTES = 14 // версия, nTime, счётчики, locktime
const INPUT_BYTES = 148 // p2pkh со сжатым ключом
const OUTPUT_BYTES = 34 // p2pkh
const OP_RETURN_OVERHEAD_BYTES = 11 // сумма, длины, сам OP_RETURN

export interface TransferShape {
  /** Сколько входов тратим. */
  inputs: number
  /** Сколько выходов получателям (без сдачи). */
  outputs: number
  /** Длина сообщения в OP_RETURN, байт UTF-8. 0 — сообщения нет. */
  messageBytes?: number
}

/**
 * Оценка размера. Считаем со сдачей всегда: её выход либо будет, либо
 * транзакция окажется меньше оценки — а переплатить безопаснее, чем недодать.
 */
export function estimateTransferSizeBytes(shape: TransferShape): number {
  const message = shape.messageBytes ?? 0
  return (
    TX_OVERHEAD_BYTES +
    INPUT_BYTES * Math.max(1, shape.inputs) +
    OUTPUT_BYTES * (Math.max(1, shape.outputs) + 1) +
    (message > 0 ? OP_RETURN_OVERHEAD_BYTES + message : 0)
  )
}

/** Комиссия перевода в сатоши. */
export function transferFeeSatoshis(shape: TransferShape): number {
  const size = estimateTransferSizeBytes(shape)
  const byRate = Math.ceil((size * TRANSFER_FEE_SAT_PER_KB) / 1000)
  return Math.min(MAX_TRANSFER_FEE_SATOSHIS, Math.max(MIN_TRANSFER_FEE_SATOSHIS, byRate))
}

/** Комиссия перевода в PKOIN — в этих единицах её ждут сборщик и выбор входов. */
export function transferFee(shape: TransferShape): number {
  return transferFeeSatoshis(shape) / AMOUNT_MULTIPLIER
}
