// Дешёвые синхронные проверки правдоподобия расшифровки (P0-1).
//
// crypto-js AES-CBC (encryption.ts) НЕ аутентифицирован: PKCS7-анпэд при неверном
// ключе ~1/256 «удаётся» и возвращает мусор, не бросая. Поэтому и миграция, и
// heal-ветки чтения обязаны отличать корректную расшифровку от случайного мусора
// по ФОРМЕ (не криптографически). Легитимные секреты/списки всегда проходят —
// проверка отсекает лишь мусор, никогда не ложно-режет настоящие данные.

/** Похоже на мнемонику (12/15/18/21/24 слова-буквы) или приватник (hex64 / WIF). */
export function looksLikeSecret(plain: string): boolean {
  const t = plain.trim()
  if (!t) return false
  const words = t.split(/\s+/)
  const looksMnemonic =
    [12, 15, 18, 21, 24].includes(words.length) && words.every((w) => /^[\p{L}]+$/u.test(w))
  const looksHex = /^[0-9a-fA-F]{64}$/.test(t)
  const looksWif = /^[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(t)
  return looksMnemonic || looksHex || looksWif
}

/** Похоже на список аккаунтов: JSON с массивом accounts и полем currentAccount. */
export function looksLikeAccountsList(plain: string): boolean {
  try {
    const o = JSON.parse(plain) as { accounts?: unknown; currentAccount?: unknown }
    return !!o && Array.isArray(o.accounts) && 'currentAccount' in o
  } catch {
    return false
  }
}
