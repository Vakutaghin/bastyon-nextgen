/**
 * Сборка контентной (социальной) транзакции Pocketnet: входы + OP_RETURN с
 * [operationType, hash256(serializedData), ...opReturnData] + change.
 * Для отправки используйте sendTransactionWithMessage.
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
import type { KeyPair } from '../../types/keys'
import type { UTXO } from '@/composables/use-wallet-queries'
import { POCKETNET_NETWORK } from '../../constants/network'
import { AMOUNT_MULTIPLIER, toSatoshis, DUST_VALUE } from '../../constants/transactions'
import { loadPocketnetBitcoin, getTransactionBuilder, hash256 } from './btc17-loader'

/**
 * Интерфейс для параметров сборки транзакции
 */
export interface BuildTransactionParams {
  /** Unspents для использования в транзакции */
  unspents: UTXO[]
  /** Адрес отправителя (для change output) */
  fromAddress: string
  /** Ключевая пара для подписи */
  keyPair: KeyPair
  /** Сериализованные данные для OP_RETURN */
  serializedData: string
  /** Тип операции (например, 'userInfo') */
  operationType: string
  /** Дополнительные данные для OP_RETURN (опционально) */
  opReturnData?: Buffer | Buffer[]
  /** Комиссия в PKOIN (по умолчанию 0.00000001) */
  fee?: number
  /** Временная разница с нодой (для addNTime) */
  timeDifference?: number
  /** Отложенная транзакция (timestamp) */
  delayedNtime?: number
}

/**
 * Интерфейс результата сборки транзакции
 */
export interface BuiltTransaction {
  /** Hex представление транзакции */
  hex: string
  /** Сумма всех входов */
  totalInputAmount: number
  /** Сумма всех выходов */
  totalOutputAmount: number
  /** Использованные unspents */
  usedUnspents: UTXO[]
  /** Выходы транзакции */
  outputs: Array<{
    address: string
    amount: number
    deleted?: boolean
  }>
}

/**
 * Собирает транзакцию для отправки данных в блокчейн
 * @param params - Параметры сборки транзакции
 * @returns Собранная транзакция в hex формате
 */
export async function buildTransaction(params: BuildTransactionParams): Promise<BuiltTransaction> {
  // Убеждаемся, что библиотека загружена (бросает при ошибке загрузки).
  const pocketnetBitcoinLib = await loadPocketnetBitcoin()

  // Получаем TransactionBuilder из загруженной библиотеки
  const TransactionBuilder = getTransactionBuilder()
  const {
    unspents,
    fromAddress,
    keyPair,
    serializedData,
    operationType,
    opReturnData,
    fee = 1 / AMOUNT_MULTIPLIER,
    timeDifference = 0,
    delayedNtime,
  } = params

  if (!unspents || unspents.length === 0) {
    throw new Error('No unspents provided')
  }

  if (!keyPair || !keyPair.ecPair) {
    throw new Error('Valid key pair is required')
  }

  // Вычисляем общую сумму входов
  // В старом приложении unspents.amount уже в PKOIN, нужно конвертировать в сатоши
  const totalInputAmount = unspents.reduce((sum, u) => sum + u.amount, 0)
  const totalInputAmountSatoshis = toSatoshis(totalInputAmount)

  // Комиссия в сатоши
  const feeSatoshis = toSatoshis(fee)

  // Сумма для change output (все входы минус комиссия)
  const changeAmountSatoshis = totalInputAmountSatoshis - feeSatoshis

  if (changeAmountSatoshis < 0) {
    throw new Error('Insufficient funds to cover transaction fee')
  }

  // Если change меньше dust value, отправляем все на комиссию
  const finalChangeAmount =
    changeAmountSatoshis >= toSatoshis(DUST_VALUE) ? changeAmountSatoshis : 0

  // Создаем TransactionBuilder
  const txb = new TransactionBuilder(POCKETNET_NETWORK)

  // Добавляем временную разницу (если указана)
  // В старом приложении это используется для синхронизации времени с нодой
  // В Pocketnet используется кастомный метод addNTime
  if (timeDifference !== 0) {
    txb.addNTime(timeDifference)
  } else {
    // В старом коде всегда вызывается addNTime, даже если timeDifference = 0
    txb.addNTime(0)
  }

  // Handle delayed transaction (locktime)
  if (delayedNtime) {
    // setLockTime is used for delayed execution
    // Logic from pocketnet.gui: txb.setLockTime(delayedNtime + timeDifference)
    if (typeof txb.setLockTime === 'function') {
      txb.setLockTime(delayedNtime + timeDifference)
    } else {
      console.warn('[buildTransaction] setLockTime method not found in TransactionBuilder')
    }

    // Also set nTime if available (though addNTime above might handle it, explicit set is safer for some nodes)
    if (typeof txb.setNTime === 'function') {
      txb.setNTime(delayedNtime)
    }
  }

  // Добавляем входы (unspents)
  unspents.forEach((unspent) => {
    if (!unspent.scriptPubKey) {
      throw new Error(`Missing scriptPubKey for unspent ${unspent.txid}:${unspent.vout}`)
    }

    // Добавляем вход: txid, vout, sequence (null = максимальный), scriptPubKey
    // В старом коде используется null для sequence, а не undefined или 0xffffffff
    // Если есть delayedNtime, sequence должен быть 4294967294 (0xFFFFFFFE), чтобы включить locktime
    const sequence = delayedNtime ? 4294967294 : null

    txb.addInput(unspent.txid, unspent.vout, sequence, Buffer.from(unspent.scriptPubKey, 'hex'))
  })

  // Создаем данные для OP_RETURN
  // Формат: [operationType, hash256(serializedData), ...opReturnData]
  // В старом коде: Buffer.from(pocketnetBitcoinLib.crypto.hash256(self.object.serialize()), 'utf8')
  // Но hash256 уже возвращает Buffer, поэтому используем его напрямую
  const dataHash = hash256(serializedData)
  const opReturnBuffers: Buffer[] = [Buffer.from(operationType, 'utf8'), dataHash]

  // Добавляем дополнительные данные для OP_RETURN, если есть
  if (opReturnData) {
    if (Array.isArray(opReturnData)) {
      opReturnBuffers.push(...opReturnData)
    } else {
      opReturnBuffers.push(opReturnData)
    }
  }

  // Создаем OP_RETURN output
  const embed = pocketnetBitcoinLib.payments.embed({ data: opReturnBuffers })
  if (!embed.output) {
    throw new Error('Failed to create OP_RETURN output')
  }
  txb.addOutput(embed.output, 0)

  // Добавляем change output, если сумма больше dust
  if (finalChangeAmount > 0) {
    txb.addOutput(fromAddress, finalChangeAmount)
  }

  // Подписываем транзакцию
  // ВНИМАНИЕ: Pocketnet использует специфичную логику подписи
  // Если используется bitcoinjs-lib 5.x+, нужно передавать keyPair.network
  unspents.forEach((_unspent, index) => {
    // Объектная форма (TxbSignArg) вместо позиционной txb.sign(index, keyPair) —
    // последняя в bitcoinjs-lib v5+ выдаёт DEPRECATED-варнинг. Входы социальных
    // транзакций всегда p2pkh (адрес пользователя P/T), prevOutScript builder
    // берёт из addInput, поэтому передавать его не нужно.
    txb.sign({ prevOutScriptType: 'p2pkh', vin: index, keyPair: keyPair.ecPair })
  })

  // Строим транзакцию
  const tx = txb.build()
  const hex = tx.toHex()

  // Формируем список выходов для результата
  const resultOutputs: Array<{ address: string; amount: number; deleted?: boolean }> = []

  // Добавляем OP_RETURN выход (виртуально, как в старом коде)
  resultOutputs.push({
    address: fromAddress,
    amount: 0,
    deleted: true,
  })

  // Добавляем change output
  if (finalChangeAmount > 0) {
    resultOutputs.push({
      address: fromAddress,
      amount: finalChangeAmount / AMOUNT_MULTIPLIER, // Конвертируем обратно в PKOIN
    })
  }

  // Вычисляем общий выход
  const totalOutputAmount = resultOutputs.reduce((sum, out) => sum + out.amount, 0)

  return {
    hex,
    totalInputAmount,
    totalOutputAmount,
    usedUnspents: unspents,
    outputs: resultOutputs,
  }
}
