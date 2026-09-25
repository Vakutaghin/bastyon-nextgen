/**
 * Модуль утилит
 * Экспорт всех утилитных функций
 */

// Buffer polyfill (side-effect import — sets up globalThis.Buffer)
export { Buffer } from './buffer-polyfill'

// Криптографические хеши
export { sha256, hash256, hexEncode } from './crypto-hash'

// QR-коды
export { generateQRCode, readQRCode } from './qr-code'
