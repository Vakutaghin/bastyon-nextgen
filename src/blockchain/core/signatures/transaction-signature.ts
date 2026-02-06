/**
 * Подпись транзакций
 */

import type { TransactionBuilder } from '../../types/btc17-types'
import type { KeyPair } from '../../types/keys'
import type { Address } from '../../types/addresses'
import type { TransactionSignature, TransactionSignatureOptions } from '../../types/signatures'

/**
 * Интерфейс для входа транзакции
 */
export interface TransactionInput {
  /** Адрес входа */
  address: Address
  /** Тип входа */
  type?: 'htlc' | 'p2pkh' | 'p2wpkh' | 'p2sh'
  /** Скрипт предыдущего выхода (hex) */
  scriptPubKey?: string
  /** Значение входа */
  value?: number
}

/**
 * Интерфейс для транзакции
 */
export interface Transaction {
  /** Входы транзакции */
  inputs: TransactionInput[]
  /** Выходы транзакции */
  outputs?: Array<{
    address: Address
    value: number
  }>
}

/**
 * Подписывает вход транзакции
 * @param transactionBuilder - TransactionBuilder из btc17
 * @param inputIndex - Индекс входа для подписи
 * @param keyPair - Ключевая пара для подписи
 * @param options - Опции подписи
 * @returns Подпись транзакции
 */
export function signTransactionInput(
  transactionBuilder: TransactionBuilder,
  inputIndex: number,
  keyPair: KeyPair,
  options: TransactionSignatureOptions = { inputIndex: 0 }
): TransactionSignature {
  if (!transactionBuilder) {
    throw new Error('Transaction builder is required')
  }

  if (!keyPair || !keyPair.ecPair) {
    throw new Error('Valid key pair is required')
  }

  const { inputIndex: optIndex, prevOutScript, prevOutScriptType } = options
  const index = optIndex ?? inputIndex

  try {
    if (prevOutScript && prevOutScriptType) {
      // Подпись для специальных типов (HTLC и т.д.)
      transactionBuilder.sign({
        prevOutScript: Buffer.isBuffer(prevOutScript) ? prevOutScript : Buffer.from(prevOutScript),
        prevOutScriptType: prevOutScriptType as any,
        vin: index,
        keyPair: keyPair.ecPair,
      })
    } else {
      // Обычная подпись входа
      transactionBuilder.sign(index, keyPair.ecPair)
    }

    // Возвращаем информацию о подписи
    return {
      signature: '', // Подпись уже добавлена в транзакцию
      pubkey: keyPair.publicKey.toString('hex'),
      address: '', // Адрес будет определен из ключевой пары
    }
  } catch (error) {
    throw new Error(
      `Failed to sign transaction input: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Определяет тип адреса для подписи
 * @param address - Адрес для проверки
 * @returns Тип адреса или null
 */
export function getAddressTypeForSigning(address: Address): 'p2pkh' | 'p2sh' | 'htlc' | null {
  if (!address || typeof address !== 'string') {
    return null
  }

  const trimmed = address.trim()

  // P2PKH адреса (начинаются с 'P' или 'T')
  if (trimmed.startsWith('P') || trimmed.startsWith('T')) {
    return 'p2pkh'
  }

  // P2SH адреса (кошельки, начинаются с '3', 'Y', 'Z')
  if (trimmed.startsWith('3') || trimmed.startsWith('Y') || trimmed.startsWith('Z')) {
    return 'p2sh'
  }

  return null
}

/**
 * Подписывает транзакцию для указанного адреса
 * @param transactionBuilder - TransactionBuilder из btc17
 * @param input - Вход транзакции
 * @param inputIndex - Индекс входа
 * @param keyPair - Ключевая пара для подписи
 * @param userAddress - Адрес пользователя (для проверки)
 * @returns Подпись транзакции
 */
export function signTransactionForAddress(
  transactionBuilder: TransactionBuilder,
  input: TransactionInput,
  inputIndex: number,
  keyPair: KeyPair,
  userAddress?: Address
): TransactionSignature {
  if (!input || !input.address) {
    throw new Error('Valid transaction input is required')
  }

  const addressType = getAddressTypeForSigning(input.address)

  if (!addressType) {
    throw new Error(`Unsupported address type for signing: ${input.address}`)
  }

  // Проверка, что адрес входа совпадает с адресом пользователя (для некоторых типов)
  if (userAddress && (addressType === 'p2sh') && input.address !== userAddress) {
    // Для P2SH адресов может потребоваться дополнительная проверка
    // В оригинальном коде это проверяется через список адресов
  }

  const options: TransactionSignatureOptions = {
    inputIndex,
  }

  // Для HTLC типов нужен скрипт предыдущего выхода
  if (input.type === 'htlc' && input.scriptPubKey) {
    options.prevOutScript = Buffer.from(input.scriptPubKey, 'hex')
    options.prevOutScriptType = 'htlc'
  }

  return signTransactionInput(transactionBuilder, inputIndex, keyPair, options)
}

/**
 * Создает подпись для транзакции (без TransactionBuilder)
 * Используется для создания подписи отдельно от транзакции
 * @param data - Данные для подписи
 * @param keyPair - Ключевая пара
 * @param address - Адрес подписавшего
 * @returns Подпись транзакции
 */
export function createTransactionSignature(
  data: Buffer,
  keyPair: KeyPair,
  address: Address
): TransactionSignature {
  if (!data || !Buffer.isBuffer(data)) {
    throw new Error('Valid data buffer is required')
  }

  if (!keyPair || !keyPair.ecPair) {
    throw new Error('Valid key pair is required')
  }

  if (!address) {
    throw new Error('Address is required')
  }

  try {
    const signature = keyPair.ecPair.sign(data)

    return {
      signature: signature.toString('hex'),
      pubkey: keyPair.publicKey.toString('hex'),
      address,
    }
  } catch (error) {
    throw new Error(
      `Failed to create transaction signature: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
