// Коллекция для карточки в чате: один запрос на всё приложение, сколько бы
// раз её ни прислали; не удалось — в следующий раз спросим снова.

import { fetchCollection, type ChainCollection } from '@/services/collections/collections-api'

const cache = new Map<string, Promise<ChainCollection | null>>()

export function loadCollectionCard(txid: string): Promise<ChainCollection | null> {
  let pending = cache.get(txid)
  if (!pending) {
    pending = fetchCollection(txid)
      .then((c) => {
        if (!c) cache.delete(txid)
        return c
      })
      .catch(() => {
        cache.delete(txid)
        return null
      })
    cache.set(txid, pending)
  }
  return pending
}

/** Сброс памяти модуля — только для тестов. */
export function resetCollectionCardsForTests(): void {
  cache.clear()
}
