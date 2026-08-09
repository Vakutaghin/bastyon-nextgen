/**
 * Ленивая загрузка кастомной bitcoinjs-lib от Pocketnet (btc17.js) и доступ к ней.
 *
 * btc17.js — browserify-форк bitcoinjs-lib с поддержкой поля nTime в транзакциях
 * (нужно ноде Pocketnet). Держим единственный экземпляр в модульном синглтоне;
 * билдеры (build-content-transaction / build-transfer-transaction) получают его
 * через loadPocketnetBitcoin() и getTransactionBuilder(). Типы — в btc17.d.ts.
 * См. CODE_AUDIT.md §2.
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
import type { PocketnetBitcoin, BtcTransactionBuilder } from '../../lib/pocketnet/btc17.js'

let pocketnetBitcoin: PocketnetBitcoin | null = null
let pocketnetBitcoinLib: PocketnetBitcoin | null = null

export async function loadPocketnetBitcoin(): Promise<PocketnetBitcoin> {
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

export function getTransactionBuilder(): typeof BtcTransactionBuilder {
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
 * Создает хеш данных для OP_RETURN.
 * hash256 = SHA256(SHA256(data)), через crypto из загруженной btc17.js (как в старом приложении).
 */
export function hash256(data: string | Buffer): Buffer {
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
