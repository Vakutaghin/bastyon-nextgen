// Vue-free фоновая оркестрация регистрационной транзакции: ждёт unspents →
// строит userInfo-транзакцию → отправляет. Вынесено из register-modal.vue,
// чтобы tx-путь стал юнит-тестируемым (authStore передаётся аргументом, а не
// импортируется). См. LARGE_FILE_SPLIT_AUDIT.md.
import { debugLog } from '@/helpers/common/debug-log'
import type { useAuthStore } from '@/blockchain'
import { waitForUnspents } from './helpers/wait-for-unspents'
import { markPendingRegistrationStep } from './helpers/pending-registration-store'

type AuthStore = ReturnType<typeof useAuthStore>

/**
 * Фоновая задача: ждёт unspents → строит и отправляет транзакцию.
 * Срабатывает после оптимистичного `emit('validation')`. Пользователь уже
 * видит «часики» и может закрыть модалку.
 */
export async function sendRegistrationTransaction(
  nickname: string,
  authStore: AuthStore
): Promise<void> {
  try {
    const { serializeUserInfo, exportUserInfo } =
      await import('@/blockchain/core/actions/user-info-action')
    const { getUnspents, selectBestUnspents, filterAvailableUnspents } =
      await import('@/blockchain/core/transactions/unspents-manager')
    const { buildTransaction } = await import('@/blockchain/core/transactions/transaction-builder')
    const { sendTransactionWithMessage } =
      await import('@/blockchain/core/transactions/transaction-sender')
    const { DEFAULT_TX_FEE } = await import('@/blockchain/constants/transactions')
    const { deriveMessengerKeys } = await import('@/blockchain/core/keys/key-generator')
    const { getProxyWithWalletCached } = await import('@/blockchain/api/proxy-with-wallet')

    const address = authStore.getUserAddress
    const keyPair = authStore.getKeyPair

    if (!address || !keyPair) {
      console.error('[REG-BG] No keys/address')
      return
    }

    const cryptoKeys = deriveMessengerKeys(keyPair.privateKey)
    const publicKeys = cryptoKeys.map((k) => k.public)

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

    // Пробуем получить unspents — возможно, уже пришли.
    let unspents = await getUnspents(address, 0, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    debugLog('[REG-BG] Initial unspents:', unspents.length)

    if (unspents.length === 0) {
      const proxyServer = await getProxyWithWalletCached()
      unspents = await waitForUnspents({
        address,
        getUnspents,
        filterAvailableUnspents,
        proxyServer: proxyServer || undefined,
      })
      debugLog('[REG-BG] Got unspents after waiting:', unspents.length)
    }

    const selectedUnspents = selectBestUnspents(unspents, 0)
    if (selectedUnspents.length === 0) {
      console.error('[REG-BG] No usable unspents after waiting')
      return
    }

    debugLog('[REG-BG] Building transaction...')
    const builtTx = await buildTransaction({
      unspents: selectedUnspents,
      fromAddress: address,
      keyPair,
      serializedData: serialized,
      operationType: 'userInfo',
      fee: DEFAULT_TX_FEE,
      timeDifference: 0,
    })

    debugLog('[REG-BG] Sending transaction...')
    const txid = await sendTransactionWithMessage({
      hex: builtTx.hex,
      messageData: userInfoExport,
      operationType: 'userInfo',
    })

    debugLog('[REG-BG] Transaction sent! txid:', txid)

    markPendingRegistrationStep(3)
    authStore.resetMessenger(true).catch(() => {})
  } catch (err) {
    console.error('[REG-BG] Background transaction error:', err)
    // Ошибку не показываем — «часики» уже крутятся в overlay'е, при
    // следующей перезагрузке `checkPendingRegistration` попробует снова.
  }
}
