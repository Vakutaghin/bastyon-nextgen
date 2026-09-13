/**
 * Сборка транзакций Pocketnet — barrel.
 *
 * Реализация разнесена по модулям (аудит крупных файлов 2026-08):
 * - btc17-loader          — ленивая загрузка кастомной btc17.js + доступ к ней
 * - build-content-transaction — контентные (социальные) транзакции с OP_RETURN
 * - build-transfer-transaction — переводы PKOIN
 *
 * Путь импорта и публичный API сохранены (buildTransaction /
 * buildTransferTransaction + их типы), чтобы существующие call-site'ы и тесты
 * не менялись.
 */

export { buildTransaction } from './build-content-transaction'
export type { BuildTransactionParams, BuiltTransaction } from './build-content-transaction'

export { buildTransferTransaction } from './build-transfer-transaction'
export type {
  BuildTransferTransactionParams,
  BuiltTransferTransaction,
} from './build-transfer-transaction'
