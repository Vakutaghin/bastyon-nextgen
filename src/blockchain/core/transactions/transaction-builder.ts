/**
 * Модуль для сборки транзакций Pocketnet
 *
 * ВАЖНО: Используем кастомную версию bitcoinjs-lib от Pocketnet (btc17.js)
 * которая поддерживает поле nTime в транзакциях, необходимое для ноды Pocketnet
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
import type { KeyPair } from '../../types/keys'
import type { UTXO } from '@/composables/use-wallet-queries'
import { POCKETNET_NETWORK } from '../../constants/network'
import { AMOUNT_MULTIPLIER, toSatoshis, DUST_VALUE } from '../../constants/transactions'

// Импортируем кастомную версию bitcoinjs-lib от Pocketnet.
// btc17.js — browserify-форк bitcoinjs-lib, типы описаны в btc17.d.ts (см. CODE_AUDIT.md §2).
import type { PocketnetBitcoin, BtcTransactionBuilder } from '../../lib/pocketnet/btc17.js'

let pocketnetBitcoin: PocketnetBitcoin | null = null
let pocketnetBitcoinLib: PocketnetBitcoin | null = null

async function loadPocketnetBitcoin(): Promise<PocketnetBitcoin> {
  if (pocketnetBitcoin) return pocketnetBitcoin

  try {
    try {
      const module = await import('../../lib/pocketnet/btc17.js')

      // Browserify-модуль может отдавать API через default или напрямую — поддерживаем оба.
      const fromImport = (module.default ?? module) as unknown as PocketnetBitcoin
      pocketnetBitcoin = fromImport
      pocketnetBitcoinLib = fromImport

      // Fallback на window.pocketnetBitcoin — btc17.js навешивает себя туда (см. lib/pocketnet/btc17.js:43-45).
      // Нужен, если бандлер по каким-то причинам отдал пустой объект.
      const hasTxBuilder = !!(
        pocketnetBitcoinLib.TransactionBuilder ||
        (pocketnetBitcoinLib as { default?: PocketnetBitcoin }).default?.TransactionBuilder
      )
      if (!hasTxBuilder && typeof window !== 'undefined') {
        const windowBitcoin = (window as { pocketnetBitcoin?: PocketnetBitcoin }).pocketnetBitcoin
        if (windowBitcoin) {
          pocketnetBitcoinLib = windowBitcoin
          pocketnetBitcoin = windowBitcoin
        }
      }

      const hasTxBuilderNow = !!(
        pocketnetBitcoinLib?.TransactionBuilder ||
        (pocketnetBitcoinLib as { default?: PocketnetBitcoin } | null)?.default?.TransactionBuilder
      )
      if (pocketnetBitcoinLib && hasTxBuilderNow) {
        return pocketnetBitcoin!
      }
      console.error(
        '[buildTransaction] Loaded module does not contain TransactionBuilder:',
        pocketnetBitcoinLib
      )
    } catch (e) {
      console.error('[buildTransaction] Dynamic import failed:', e)
    }

    throw new Error('Failed to load Pocketnet bitcoinjs-lib (btc17.js)')
  } catch (error) {
    console.error('[buildTransaction] Critical error loading btc17.js:', error)
    throw error
  }
}

function getTransactionBuilder(): typeof BtcTransactionBuilder {
  if (!pocketnetBitcoinLib) {
    throw new Error('Pocketnet bitcoinjs-lib is not loaded. Call loadPocketnetBitcoin() first.')
  }

  const direct = pocketnetBitcoinLib.TransactionBuilder
  if (direct) return direct

  const viaDefault = (pocketnetBitcoinLib as { default?: PocketnetBitcoin }).default
    ?.TransactionBuilder
  if (viaDefault) return viaDefault

  throw new Error('TransactionBuilder not found in pocketnet bitcoinjs-lib')
}

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
 * Создает хеш данных для OP_RETURN
 * Использует hash256 (SHA256 дважды) как в старом приложении
 */
function hash256(data: string | Buffer): Buffer {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  // hash256 = SHA256(SHA256(data))
  // Используем crypto из кастомной библиотеки
  if (!pocketnetBitcoinLib || !pocketnetBitcoinLib.crypto) {
    throw new Error(
      'Pocketnet bitcoinjs-lib is not initialized. Call loadPocketnetBitcoin() first.'
    )
  }
  const firstHash = pocketnetBitcoinLib.crypto.sha256(buffer)
  return pocketnetBitcoinLib.crypto.sha256(firstHash)
}

/**
 * Собирает транзакцию для отправки данных в блокчейн
 * @param params - Параметры сборки транзакции
 * @returns Собранная транзакция в hex формате
 */
export async function buildTransaction(params: BuildTransactionParams): Promise<BuiltTransaction> {
  // Убеждаемся, что библиотека загружена
  await loadPocketnetBitcoin()

  if (!pocketnetBitcoinLib) {
    throw new Error(
      'Pocketnet bitcoinjs-lib (btc17.js) is not loaded. Please check the console for errors.'
    )
  }

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

/** Параметры для сборки транзакции перевода PKOIN */
export interface BuildTransferTransactionParams {
  unspents: UTXO[]
  /** Адрес для сдачи (change) */
  fromAddress: string
  /** Список адресов-источников (для messageData) */
  sourceAddresses: string[]
  keyPair: KeyPair
  /** Выходы: адрес получателя и сумма в PKOIN */
  outputs: Array<{ address: string; amount: number }>
  /** Комиссия в PKOIN */
  fee?: number
  /** Сообщение (опционально) */
  message?: string
  /** Режим комиссии: include = получатель платит, exclude = отправитель платит */
  feemode?: 'include' | 'exclude'
}

/** Результат сборки транзакции перевода */
export interface BuiltTransferTransaction {
  hex: string
  totalInputAmount: number
  totalOutputAmount: number
  usedUnspents: UTXO[]
  outputs: Array<{ address: string; amount: number }>
  /** Данные для sendrawtransactionwithmessage (второй параметр) */
  messageData: Record<string, unknown>
}

/**
 * Собирает транзакцию перевода PKOIN (только выходы на адреса, без контентного OP_RETURN).
 * Для отправки используйте sendTransactionWithMessage с operationType 'transaction'.
 */
export async function buildTransferTransaction(
  params: BuildTransferTransactionParams
): Promise<BuiltTransferTransaction> {
  await loadPocketnetBitcoin()

  if (!pocketnetBitcoinLib) {
    throw new Error('Pocketnet bitcoinjs-lib (btc17.js) is not loaded.')
  }

  const TransactionBuilder = getTransactionBuilder()
  const {
    unspents,
    fromAddress,
    sourceAddresses: sourceAddressesParam,
    keyPair,
    outputs,
    fee = 1 / AMOUNT_MULTIPLIER,
    message = '',
    feemode = 'include',
  } = params

  if (!unspents?.length) {
    throw new Error('No unspents provided')
  }

  if (!keyPair?.ecPair) {
    throw new Error('Valid key pair is required')
  }

  const totalInputAmount = unspents.reduce((sum, u) => sum + u.amount, 0)
  const totalInputSatoshis = toSatoshis(totalInputAmount)
  const feeSatoshis = toSatoshis(fee)

  const outputsAmount = outputs.reduce((s, o) => s + o.amount, 0)
  const outputsSatoshis = outputs.reduce((s, o) => s + toSatoshis(o.amount), 0)
  const changeAmountSatoshis = totalInputSatoshis - outputsSatoshis - feeSatoshis

  if (changeAmountSatoshis < 0) {
    throw new Error('Insufficient funds for the transfer, taking into account the commission')
  }

  const finalChangeAmount =
    changeAmountSatoshis >= toSatoshis(DUST_VALUE) ? changeAmountSatoshis : 0

  const txb = new TransactionBuilder(POCKETNET_NETWORK)
  txb.addNTime(0)

  unspents.forEach((unspent) => {
    if (!unspent.scriptPubKey) {
      throw new Error(`Missing scriptPubKey for unspent ${unspent.txid}:${unspent.vout}`)
    }
    txb.addInput(unspent.txid, unspent.vout, null, Buffer.from(unspent.scriptPubKey, 'hex'))
  })

  // Выходы: сначала получатели, потом сдача
  outputs.forEach((out) => {
    txb.addOutput(out.address, toSatoshis(out.amount))
  })

  if (finalChangeAmount > 0) {
    txb.addOutput(fromAddress, finalChangeAmount)
  }

  unspents.forEach((_unspent, index) => {
    txb.sign(index, keyPair.ecPair)
  })

  const tx = txb.build()
  const hex = tx.toHex()

  const derivedSources = [
    ...new Set(unspents.map((u) => u.address).filter((a): a is string => Boolean(a))),
  ]
  const sourceList =
    sourceAddressesParam?.length > 0
      ? sourceAddressesParam
      : derivedSources.length
        ? derivedSources
        : [fromAddress]

  const messageData: Record<string, unknown> = {
    source: { v: sourceList },
    reciever: { v: outputs },
    message: { v: message },
    feemode: { v: feemode },
  }

  return {
    hex,
    totalInputAmount,
    totalOutputAmount: outputsAmount,
    usedUnspents: unspents,
    outputs,
    messageData,
  }
}
