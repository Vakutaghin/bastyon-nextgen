// Коллекции и плейлисты — транзакция `collection` (220): новая, правка и
// удаление (`contentDelete`, как у поста).
//
// Формат — services/collections/collection-model.ts, сверен с mainnet. Нода
// отказывает: больше 5 правок за месяц (ContentEditLimit), вторая правка той
// же коллекции, пока первая не в блоке (DoubleContentEdit), нет регистрации,
// payload больше 2000 байт.

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '../transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
  unlockUTXOs,
} from '../transactions/unspents-manager'
import { broadcastTransaction } from '../transactions/transaction-sender'
import { NodeRejectError } from '../transactions/node-reject'
import { DEFAULT_TX_FEE } from '../../constants/transactions'
import {
  collectionPayload,
  serializeCollection,
  validateCollectionDraft,
  type CollectionDraft,
  type CollectionPayload,
} from '@/services/collections/collection-model'
import { t } from '@/i18n'

export class CollectionDraftInvalid extends Error {
  constructor(public readonly reason: string) {
    super(t(`collections.invalid.${reason}`))
    this.name = 'CollectionDraftInvalid'
  }
}

async function send(
  serializedData: string,
  messageData: object,
  operationType: 'collection' | 'contentDelete',
  pending: { kind: 'collection' | 'collectionEdit' | 'collectionDelete'; title?: string }
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress
  if (!keyPair || !address) throw new Error(t('collections.errAuth'))

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectBestUnspents(unspents ?? [], DEFAULT_TX_FEE)
  if (!selected.length) throw new Error(t('collections.errNoCoins'))
  lockUTXOs(selected)

  try {
    const built = await buildTransaction({
      unspents: selected,
      fromAddress: address,
      keyPair,
      serializedData,
      operationType,
      fee: DEFAULT_TX_FEE,
    })
    return await broadcastTransaction({ hex: built.hex, messageData, operationType, pending })
  } catch (error) {
    // Нода отвергла — монеты не ушли, следующая попытка должна их видеть.
    if (error instanceof NodeRejectError) unlockUTXOs(selected)
    throw error
  }
}

/** Новая коллекция или правка (`draft.rootTxid`). Возвращает txid транзакции. */
export async function sendCollection(
  draft: CollectionDraft
): Promise<{ txid: string; payload: CollectionPayload }> {
  const invalid = validateCollectionDraft(draft)
  if (invalid) throw new CollectionDraftInvalid(invalid)
  const payload = collectionPayload(draft)
  const txid = await send(serializeCollection(payload), payload, 'collection', {
    kind: draft.rootTxid ? 'collectionEdit' : 'collection',
    title: payload.c,
  })
  return { txid, payload }
}

/** Удалить коллекцию: `contentDelete` с её txid (первой версии). */
export async function deleteCollection(rootTxid: string, title?: string): Promise<string> {
  return send(rootTxid, { txidEdit: rootTxid }, 'contentDelete', {
    kind: 'collectionDelete',
    ...(title ? { title } : {}),
  })
}
