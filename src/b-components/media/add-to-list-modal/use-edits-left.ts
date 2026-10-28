// Сколько правок осталось у своих коллекций: нода пускает 5 за 43 200 блоков.
// История версий — у одной коллекции (getrawtransactionwithmessagebyid),
// поэтому спрашиваем по каждой; плюс свои правки, ещё не попавшие в блок.

import { ref, type Ref } from 'vue'
import { fetchCollection, editsInWindow } from '@/services/collections/collections-api'
import { COLLECTION_EDIT_LIMIT } from '@/services/collections/collection-model'
import { fetchCurrentBlockHeight } from '@/stores/notifications-fetch'
import { useCollectionsStore, type CollectionView } from '@/stores/collections-store'

export function useEditsLeft(list: Ref<CollectionView[]>) {
  const collections = useCollectionsStore()
  const editsLeft = ref<Record<string, number>>({})

  async function refresh(): Promise<void> {
    const targets = list.value.filter((c) => c.pending !== 'create')
    if (!targets.length) return
    const tip = await fetchCurrentBlockHeight().catch(() => 0)
    if (!tip) return
    const entries = await Promise.all(
      targets.map(async (c) => {
        const chain = await fetchCollection(c.txid).catch(() => null)
        if (!chain) return null
        const used = editsInWindow({ ...chain, height: c.height ?? chain.height }, tip)
        const left = COLLECTION_EDIT_LIMIT - used - collections.pendingEditsOf(c.txid)
        return [c.txid, Math.max(0, left)] as const
      })
    )
    const next: Record<string, number> = { ...editsLeft.value }
    for (const e of entries) if (e) next[e[0]] = e[1]
    editsLeft.value = next
  }

  return { editsLeft, refresh }
}
