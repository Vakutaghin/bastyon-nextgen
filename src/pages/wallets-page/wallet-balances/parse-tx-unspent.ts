// Чистый парсер ответа txunspent: сумма всех UTXO в САТОШИ. Нода отдаёт
// `amount` в PKOIN (дробное) и `amountSat`; берём amountSat, иначе округляем
// amount × 1e8. Ответ бывает либо {result,data:[...]}, либо голым массивом.
// Единая шкала с `getuserprofile.balance` (сатоши), из которой берётся баланс
// основного кошелька (аудит V5: раньше PKOIN складывались с сатоши).
import { toSatoshis } from '@/blockchain/constants/transactions'

interface UnspentLike {
  amount?: number
  amountSat?: number
}

export function parseTxUnspentResponse(res: unknown): number {
  if (!res || typeof res !== 'object') return 0
  let list: UnspentLike[] = []
  const r = res as Record<string, unknown>
  if (Array.isArray(r.data) && (r.result === 'success' || !('result' in r))) {
    list = r.data as UnspentLike[]
  } else if (Array.isArray(res)) {
    list = res as UnspentLike[]
  }
  return list.reduce((s, u) => {
    if (typeof u.amountSat === 'number') return s + u.amountSat
    return s + (typeof u.amount === 'number' ? toSatoshis(u.amount) : 0)
  }, 0)
}
