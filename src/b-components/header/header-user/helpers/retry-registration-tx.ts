// Повторная фоновая отправка транзакции регистрации (step 2 → 3).
// Вызывается, если приложение перезагрузили между свободной отправкой свободных средств
// и отправкой userInfo-tx. Все блокчейн-модули подгружаются динамически — header не тянет их.

import type { KeyPair } from '@/blockchain/types/keys'
import {
  markPendingRegistrationStep,
  clearPendingRegistration,
} from '@/b-components/header/register-modal/helpers/pending-registration-store'

/** Исход попытки повторной отправки регистрационной транзакции. */
export type RetryRegistrationOutcome =
  /** транзакция успешно отправлена, step переведён в 3 */
  | 'sent'
  /** нет UTXO — повторим на следующей проверке статуса */
  | 'no-funds'
  /** фатальная ошибка от блокчейна (NicknameLong/code:18/code:19) — pending следует очистить */
  | 'fatal'
  /** транзиентная ошибка (сеть и т.п.) — пробовать снова при следующем тике */
  | 'transient-error'

interface RetryOptions {
  address: string | null
  keyPair: KeyPair | null
  nickname: string
}

const LOG_PREFIX = '[retry-registration-tx]'

/** Эвристика "фатальной" ошибки от блокчейна, после которой ретраить бессмысленно. */
const isFatalError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NicknameLong') || msg.includes('code":19') || msg.includes('code":18')
}

export async function retryRegistrationBackgroundTx(
  opts: RetryOptions
): Promise<RetryRegistrationOutcome> {
  const { address, keyPair, nickname } = opts
  if (!address || !keyPair) return 'transient-error'

  try {
    const [
      { serializeUserInfo, exportUserInfo },
      { getUnspents, selectBestUnspents, filterAvailableUnspents },
      { buildTransaction },
      { sendTransactionWithMessage },
      { DEFAULT_TX_FEE },
      { deriveMessengerKeys },
    ] = await Promise.all([
      import('@/blockchain/core/actions/user-info-action'),
      import('@/blockchain/core/transactions/unspents-manager'),
      import('@/blockchain/core/transactions/transaction-builder'),
      import('@/blockchain/core/transactions/transaction-sender'),
      import('@/blockchain/constants/transactions'),
      import('@/blockchain/core/keys/key-generator'),
    ])

    const cryptoKeys = deriveMessengerKeys(keyPair.privateKey)
    const publicKeys = cryptoKeys.map((k: { public: string }) => k.public)

    const userInfoData = {
      name: nickname,
      about: '',
      site: '',
      language: 'ru',
      image: '',
      addresses: [],
      ref: '',
      keys: publicKeys,
    }

    const serialized = serializeUserInfo(userInfoData)
    const userInfoExport = exportUserInfo(userInfoData, false)

    let unspents = await getUnspents(address, 0, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    console.log(LOG_PREFIX, 'unspents available:', unspents.length)
    if (unspents.length === 0) {
      console.log(LOG_PREFIX, 'no unspents, will retry on next check')
      return 'no-funds'
    }

    const selectedUnspents = selectBestUnspents(unspents, 0)
    if (selectedUnspents.length === 0) return 'no-funds'

    console.log(LOG_PREFIX, 'building transaction...')
    const builtTx = await buildTransaction({
      unspents: selectedUnspents,
      fromAddress: address,
      keyPair,
      serializedData: serialized,
      operationType: 'userInfo',
      fee: DEFAULT_TX_FEE,
      timeDifference: 0,
    })

    console.log(LOG_PREFIX, 'sending transaction...')
    const txid = await sendTransactionWithMessage({
      hex: builtTx.hex,
      messageData: userInfoExport,
      operationType: 'userInfo',
    })
    console.log(LOG_PREFIX, 'transaction sent! txid:', txid)

    markPendingRegistrationStep(3)
    return 'sent'
  } catch (err) {
    console.error(LOG_PREFIX, 'error:', err)
    if (isFatalError(err)) {
      console.log(LOG_PREFIX, 'fatal registration error, clearing pending')
      clearPendingRegistration()
      return 'fatal'
    }
    return 'transient-error'
  }
}
