// Чистый парсер ответа txunspent: суммирует amount всех UTXO. Ответ ноды бывает
// либо {result,data:[...]}, либо голым массивом. Вынесено из wallets-page
// (см. LARGE_FILE_SPLIT_AUDIT.md) — юнит-тестируемо.
export function parseTxUnspentResponse(res: unknown): number {
  if (!res || typeof res !== 'object') return 0
  let list: { amount?: number }[] = []
  const r = res as Record<string, unknown>
  if (Array.isArray(r.data) && (r.result === 'success' || !('result' in r))) {
    list = r.data as { amount?: number }[]
  } else if (Array.isArray(res)) {
    list = res as { amount?: number }[]
  }
  return list.reduce((s, u) => s + (u.amount ?? 0), 0)
}
