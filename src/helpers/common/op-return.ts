/**
 * OP_RETURN перевода: туда старый клиент и это приложение пишут сообщение
 * отправителя, а у чаевых — метку `a:donate` (build-transfer-transaction).
 */

/** Метка чаевых в OP_RETURN перевода. */
export const DONATE_MARKER = 'a:donate'

/**
 * Первый push из OP_RETURN (`6a <длина> <данные>`) как текст — как
 * `getOpreturn` старого клиента. Не OP_RETURN или не UTF-8 — undefined.
 */
export function opReturnText(scriptHex: string): string | undefined {
  if (!/^6a[0-9a-f]*$/i.test(scriptHex) || scriptHex.length < 4) return undefined
  const bytes = scriptHex.match(/../g)!.map((h) => Number.parseInt(h, 16))
  let i = 1
  const op = bytes[i++]!
  let length: number
  if (op >= 1 && op <= 0x4b) length = op
  else if (op === 0x4c) length = bytes[i++] ?? 0
  else if (op === 0x4d) {
    length = (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8)
    i += 2
  } else return undefined
  const data = bytes.slice(i, i + length)
  if (data.length !== length) return undefined
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(data))
  } catch {
    return undefined
  }
}

/** Текст первого OP_RETURN среди выходов транзакции. */
export function txOpReturnText(
  vout: ReadonlyArray<{ scriptPubKey?: { hex?: unknown } } | null | undefined> | undefined
): string | undefined {
  for (const out of vout ?? []) {
    const hex = out?.scriptPubKey?.hex
    if (typeof hex !== 'string') continue
    const text = opReturnText(hex)
    if (text !== undefined) return text
  }
  return undefined
}
