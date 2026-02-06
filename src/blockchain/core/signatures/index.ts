/**
 * Модуль работы с подписями
 * Экспорт всех функций для генерации подписей
 */

// API подписи
export {
  generateApiSignature,
  validateApiSignature,
} from './api-signature'

// Подписи транзакций
export {
  signTransactionInput,
  signTransactionForAddress,
  createTransactionSignature,
  getAddressTypeForSigning,
  type TransactionInput,
  type Transaction,
} from './transaction-signature'
