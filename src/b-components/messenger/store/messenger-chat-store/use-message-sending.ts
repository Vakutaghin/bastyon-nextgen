// Отправка текстовых сообщений (личных и групповых по протоколу общего ключа),
// реакций и PKOIN-донатов. Медиа-вложения — в use-media-sending.

import { t } from '@/i18n'

import { matrixService } from '../../services/matrix-service'
import { encryptTextWithSecret } from '../../services/encryption-service'
import {
  computeGroupUsershash,
  findCommonKeyStateEvent,
  decryptGroupCommonKey,
} from '../../services/group-encryption'
import { getAddressFromMatrixId, getMatrixId, isTetatetchat } from '../../helpers'
import { getPartnerMatrixId } from '../../room-helpers'
import type { ChatContext, MxRoom } from './types'
import type { ChatCrypto } from './use-chat-crypto'

export function useMessageSending(ctx: ChatContext, chatCrypto: ChatCrypto) {
  const { messages, authStore, uiStore } = ctx
  const {
    ensurePcryptoInitialized,
    waitForPcrypto,
    pcryptoService,
    getOrderedMemberIds,
    collectPcryptoUsers,
  } = chatCrypto

  /** Возвращает Pocketnet-адрес собеседника в личном чате. null — если это не 1-на-1. */
  const getDirectPartnerAddress = (chatId: string): string | null => {
    const room = matrixService.getRoom(chatId)
    if (!room) return null
    if (!isTetatetchat(room)) return null
    const partnerMatrixId = getPartnerMatrixId(room)
    if (!partnerMatrixId) return null
    return getAddressFromMatrixId(partnerMatrixId)
  }

  /**
   * Отправка группового зашифрованного сообщения по протоколу bastyon-chat:
   *   1) usershash = md5(<id участников кроме меня, сортировка по dbId>) + "_v13_2"
   *   2) ищем state-событие m.room.encryption со state_key `pcrypto.<my>.<hash>`;
   *      если есть — расшифровываем общий ключ; нет — генерируем и публикуем своё.
   *   3) AES-CBC шифруем тело общим ключом, отправляем m.room.message
   *      { msgtype: 'm.encrypted', body: hex, hash, block: 10 }.
   */
  const sendGroupMessage = async (chatId: string, room: MxRoom, text: string) => {
    await room.loadMembersIfNeeded?.()

    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()
    if (!pcryptoService.value) throw new Error('PcryptoService not initialized')

    const client = matrixService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    const myMatrixId = client.getUserId()
    if (!myMatrixId) throw new Error('Missing my matrix id')
    const myLocal = getMatrixId(myMatrixId)

    const memberIds = getOrderedMemberIds(room, Date.now())
    const users = await collectPcryptoUsers(memberIds)
    if (!users.find((u) => u.id === myMatrixId)) {
      throw new Error('My pcrypto keys are not available')
    }

    const hash = computeGroupUsershash(users, myLocal)
    const block = 10
    const version = 2

    let commonSecret: string | null = null
    const existing = findCommonKeyStateEvent(room, myLocal, hash)
    if (existing) {
      commonSecret = await decryptGroupCommonKey(pcryptoService.value, existing, users)
    }

    if (!commonSecret) {
      const rand = crypto.getRandomValues(new Uint8Array(32))
      commonSecret = Array.from(rand)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const encrypted = await pcryptoService.value.encryptKey(commonSecret, users, block, version)
      await matrixService.sendStateEvent(
        chatId,
        'm.room.encryption',
        { version, hash, block: encrypted.block, keys: encrypted.keys },
        `pcrypto.${myLocal}.${hash}`
      )
    }

    const bodyHex = await encryptTextWithSecret(text, commonSecret)
    await matrixService.sendEncryptedTextMessage(chatId, { body: bodyHex, hash, block })
  }

  const sendMessage = async (chatId: string, text: string) => {
    try {
      const room = matrixService.getRoom(chatId)
      // Для тет-а-тет оставляем текущее поведение (отправка m.text).
      // Для групп — протокол общего ключа.
      if (room && !isTetatetchat(room)) {
        await sendGroupMessage(chatId, room, text)
        return
      }
      await matrixService.sendMessage(chatId, text)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки сообщения:', e)
    }
  }

  const sendReaction = async (chatId: string, eventId: string, key: string) => {
    try {
      const list = messages[chatId]
      const msg = list?.find((m) => m.id === eventId)
      if (msg) {
        if (!msg.reactions) msg.reactions = []
        const existing = msg.reactions.find((r) => r.key === key)
        if (existing) {
          if (!existing.my) {
            existing.count += 1
            existing.my = true
          }
        } else {
          msg.reactions.push({ key, count: 1, my: true })
        }
      }
      await matrixService.sendReaction(chatId, eventId, key)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки реакции:', e)
    }
  }

  /**
   * Отправка PKOIN-доната в личный чат:
   *  1) собираем UTXO отправителя, выбираем подходящие;
   *  2) строим/подписываем транзакцию (buildTransferTransaction);
   *  3) шлём через sendrawtransactionwithmessage;
   *  4) пишем в Matrix-комнату событие m.text с extra-полем `pocketnet_transaction`.
   * Работает только в личных чатах. Возвращает txid либо null.
   */
  const sendPkoin = async (
    chatId: string,
    amount: number,
    messageText?: string
  ): Promise<string | null> => {
    if (!authStore.isUserAuthenticated) {
      console.error('[ChatStore] sendPkoin: not authenticated')
      return null
    }
    const fromAddress = authStore.address
    const keyPair = authStore.keyPair
    if (!fromAddress || !keyPair) {
      console.error('[ChatStore] sendPkoin: missing address or keypair')
      return null
    }
    const toAddress = getDirectPartnerAddress(chatId)
    if (!toAddress) {
      console.error('[ChatStore] sendPkoin: partner address unavailable (not a direct chat?)')
      return null
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('[ChatStore] sendPkoin: invalid amount', amount)
      return null
    }

    try {
      const [
        { getUnspents, filterAvailableUnspents, selectBestUnspents },
        { buildTransferTransaction },
        { sendTransactionWithMessage },
        { DEFAULT_TX_FEE },
      ] = await Promise.all([
        import('@/blockchain/core/transactions/unspents-manager'),
        import('@/blockchain/core/transactions/transaction-builder'),
        import('@/blockchain/core/transactions/transaction-sender'),
        import('@/blockchain/constants/transactions'),
      ])

      const rawUnspents = await getUnspents(fromAddress, 1, 9999999)
      const unspents = filterAvailableUnspents(rawUnspents, false)
      const requiredAmount = amount + DEFAULT_TX_FEE
      const selected = selectBestUnspents(unspents, requiredAmount)
      if (!selected.length) throw new Error(t('appMsg.messenger.insufficientFunds'))

      const built = await buildTransferTransaction({
        unspents: selected,
        fromAddress,
        sourceAddresses: [fromAddress],
        keyPair,
        outputs: [{ address: toAddress, amount }],
        fee: DEFAULT_TX_FEE,
        message: (messageText || '').trim(),
        feemode: 'exclude',
      })

      const txid = await sendTransactionWithMessage({
        hex: built.hex,
        messageData: built.messageData,
        operationType: 'transaction',
      })

      await matrixService.sendPkoinTransaction(chatId, {
        txid,
        amount,
        fromAddress,
        toAddress,
        message: messageText,
      })

      return txid
    } catch (e) {
      console.error('[ChatStore] sendPkoin failed:', e)
      throw e
    }
  }

  return { getDirectPartnerAddress, sendMessage, sendReaction, sendPkoin }
}

export type MessageSending = ReturnType<typeof useMessageSending>
