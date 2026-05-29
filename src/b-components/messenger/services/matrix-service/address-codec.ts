/**
 * Кодек адресов Pocketnet ↔ hex-строка для Matrix userId.
 * Совместим с legacy bastyon-chat: байты > 0x80 сдвигаются на +0x350,
 * чтобы при обратной декодировке восстановить unicode (кириллица).
 *
 * См. CODE_AUDIT.md §1.
 */

/** Pocketnet address → hex string. */
export function addressToHex(str: string): string {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    let ch = str.charCodeAt(i)
    if (ch > 0xff) ch -= 0x350
    const hex = ch.toString(16)
    result += (hex.length < 2 ? '0' : '') + hex
  }
  return result
}

/** Hex string → Pocketnet address. */
export function hexToAddress(hex: string): string {
  let result = ''
  for (let i = 0; i < hex.length; i += 2) {
    const chHex = hex.substring(i, i + 2)
    if (!/^[0-9a-fA-F]{2}$/.test(chHex)) return ''
    let charCode = parseInt(chHex, 16)
    // Restore Cyrillic characters if applicable (mapping from addressToHex).
    if (charCode >= 0x80) charCode += 0x350
    result += String.fromCharCode(charCode)
  }
  return result
}
