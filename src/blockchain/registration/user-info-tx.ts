/**
 * Единственный путь отправки регистрационной userInfo-транзакции (S15):
 * из register-modal (сразу после «точки невозврата») и из шапки после
 * перезагрузки (досыл при step=2). Раньше это были две копии с разной
 * семантикой — одна без сверки `pending.address`, обе глотали фатальные
 * ошибки ноды (занятое имя, code 18/19) и оставляли вечные «часики» (S13).
 *
 * Vue-free: authStore не импортируется, адрес/ключи приходят аргументами.
 * Все блокчейн-модули подгружаются динамически — шапка их не тянет.
 */

import { debugLog } from '@/helpers/common/debug-log'
import type { KeyPair } from '@/blockchain/types/keys'
import type { UTXO } from '@/composables/use-wallet-queries'
import {
  loadPendingRegistration,
  markPendingRegistrationError,
  markPendingRegistrationStep,
} from '@/blockchain/storage/pending-registration'

export type RegistrationTxOutcome =
  /** Транзакция отправлена, pending переведён в step=3. */
  | { outcome: 'sent'; txid: string }
  /** UTXO ещё нет — повторим на следующем тике статуса. */
  | { outcome: 'no-funds' }
  /** Нода отвергла регистрацию (имя занято/длинное) — pending помечен ошибкой, ретраить бессмысленно. */
  | { outcome: 'fatal'; message: string }
  /** Сеть/нода недоступны — pending остаётся, попробуем позже. */
  | { outcome: 'transient'; message: string }

export interface RegistrationTxOptions {
  address: string | null
  keyPair: KeyPair | null
  nickname: string
  /** Ждать появления UTXO (первичная отправка из модалки); без — только одна проба. */
  waitForFunds?: boolean
}

const LOG_PREFIX = '[registration-tx]'

/** Эвристика «фатальной» ошибки ноды: после неё ретраить бессмысленно. */
export function isFatalRegistrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('NicknameLong') ||
    msg.includes('NicknameDouble') ||
    msg.includes('code":19') ||
    msg.includes('code":18') ||
    msg.includes('code: 19') ||
    msg.includes('code: 18')
  )
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export async function sendRegistrationUserInfoTx(
  opts: RegistrationTxOptions
): Promise<RegistrationTxOutcome> {
  const { address, keyPair, nickname, waitForFunds = false } = opts
  if (!address || !keyPair) return { outcome: 'transient', message: 'no keys/address' }

  // Входы этой попытки: при отказе ноды лок снимаем, чтобы повтор их видел.
  let lockedInputs: UTXO[] = []

  try {
    const [
      { serializeUserInfo, exportUserInfo },
      { getUnspents, selectAndLockUnspents, filterAvailableUnspents },
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

    let unspents = filterAvailableUnspents(await getUnspents(address, 0, 9999999), false)
    debugLog(LOG_PREFIX, 'unspents available:', unspents.length)

    if (unspents.length === 0 && waitForFunds) {
      const [{ waitForUnspents }, { getProxyWithWalletCached }] = await Promise.all([
        import('@/b-components/header/register-modal/helpers/wait-for-unspents'),
        import('@/blockchain/api/proxy-with-wallet'),
      ])
      const proxyServer = await getProxyWithWalletCached()
      unspents = await waitForUnspents({
        address,
        getUnspents,
        filterAvailableUnspents,
        proxyServer: proxyServer || undefined,
      })
      debugLog(LOG_PREFIX, 'unspents after waiting:', unspents.length)
    }
    if (unspents.length === 0) return { outcome: 'no-funds' }

    const selectedUnspents = selectAndLockUnspents(unspents, 0) // лок входов (S6)
    if (selectedUnspents.length === 0) return { outcome: 'no-funds' }
    lockedInputs = selectedUnspents

    const builtTx = await buildTransaction({
      unspents: selectedUnspents,
      fromAddress: address,
      keyPair,
      serializedData: serialized,
      operationType: 'userInfo',
      fee: DEFAULT_TX_FEE,
      timeDifference: 0,
    })
    const txid = await sendTransactionWithMessage({
      hex: builtTx.hex,
      messageData: userInfoExport,
      operationType: 'userInfo',
    })
    debugLog(LOG_PREFIX, 'transaction sent! txid:', txid)

    // step=3 — только для pending ЭТОГО адреса: после «Добавить аккаунт»
    // запись может принадлежать другому (S15).
    if (loadPendingRegistration()?.address === address) markPendingRegistrationStep(3)
    return { outcome: 'sent', txid }
  } catch (err) {
    console.error(LOG_PREFIX, 'error:', err)
    if (isFatalRegistrationError(err)) {
      // Ключи не стираем: монеты уже на этом адресе, повтор с другим ником
      // идёт с него (register-modal), а причину пользователь должен увидеть (S13).
      markPendingRegistrationError(address, errorMessage(err))
      if (lockedInputs.length) {
        const { unlockUTXOs } = await import('@/blockchain/core/transactions/unspents-manager')
        unlockUTXOs(lockedInputs)
      }
      return { outcome: 'fatal', message: errorMessage(err) }
    }
    return { outcome: 'transient', message: errorMessage(err) }
  }
}
