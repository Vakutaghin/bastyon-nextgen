/**
 * Модуль утилит
 * Экспорт всех утилитных функций
 */

// Buffer polyfill (side-effect import — sets up globalThis.Buffer)
export { Buffer } from './buffer-polyfill'

// BIP32 пути
export {
  validateBip32Path,
  parseBip32Path,
  createBip32Path,
  getParentBip32Path,
  getLastIndexFromPath,
  isHardenedPath,
} from './bip32-paths'

// Конвертеры форматов
export {
  hexToWif,
  wifToHex,
  bufferToHex,
  hexToBuffer,
  stringToBase64,
  base64ToString,
  bufferToBase64,
  base64ToBuffer,
  hexToBase64,
  base64ToHex,
  normalizeHex,
  isValidHex,
} from './format-converters'

// QR-коды
export {
  generateQRCode,
  generateMnemonicQRCode,
  generatePrivateKeyQRCode,
  readQRCode,
  generateQRCodeDataURL,
  generateQRCodeSVG,
} from './qr-code'
