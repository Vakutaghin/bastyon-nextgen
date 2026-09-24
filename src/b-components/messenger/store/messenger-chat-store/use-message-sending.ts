// Отправка текстовых сообщений (личных и групповых по протоколу общего ключа),
// реакций и PKOIN-донатов. Медиа-вложения — в use-media-sending.

import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'

import { matrixService } from '../../services/matrix-service'
import { encryptTextWithSecret } from '../../services/encryption-service'
import {
  computeGroupUsershash,
  findCommonKeyStateEvent,
  decryptGroupCommonKey,
} from '../../services/group-encryption'
import { getAddressFromMatrixId, getMatrixId, isTetatetchat } from '../../helpers'
import { getPartnerMatrixId } from '../../room-helpers'
import type { Message } from '../../types'
import { makeTempId, pushOptimistic, removeOptimistic } from './media-sending-helpers'
import type { ChatContext, MxRoom } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import type { SendPkoinPayload } from '../../services/matrix-service/media-sender'

/**
 * Транзакция ушла в сеть, а сообщение о ней в Matrix — нет. Носит txid и
 * payload, чтобы UI предложил повторить ТОЛЬКО сообщение (аудит V2: раньше
 * повторная кнопка «Отправить» делала вторую транзакцию).
 */
/**
 * У получателя нет опубликованных ключей (`profile.k`), поэтому зашифровать для
 * него нечего. Раньше отправка «удавалась», а собеседник видел вечное
 * `*** Encrypted ***` — сообщение было зашифровано только для отправителя (S39).
 */
export class RecipientKeysMissingError extends Error {
  constructor(public readonly recipients: string[]) {
    super('recipient_keys_missing')
    this.name = 'RecipientKeysMissingError'
  }
}

export class PkoinMessageDeliveryError extends Error {
  constructor(
    public readonly txid: string,
    public readonly payload: SendPkoinPayload,
    cause: unknown
  ) {
    super('pkoin_message_not_delivered', { cause })
    this.name = 'PkoinMessageDeliveryError'
  }
}

/**
 * Проверяет, что у КАЖДОГО участника (кроме меня) есть ключи для шифрования.
 * `collectPcryptoUsers` молча пропускает тех, у кого в профиле нет `k`, и
 * сообщение уходило зашифрованным только для отправителя (S39).
 */
function assertRecipientsHaveKeys(
  memberIds: string[],
  users: { id: string }[],
  myMatrixId?: string
): void {
  const withKeys = new Set(users.map((u) => u.id))
  const missing = memberIds.filter((id) => id !== myMatrixId && !withKeys.has(id))
  if (missing.length > 0) throw new RecipientKeysMissingError(missing)
}

export function useMessageSending(ctx: ChatContext, chatCrypto: ChatCrypto) {
  const { messages, authStore, uiStore } = ctx
  const {
    ensurePcryptoInitialized,
    waitForPcrypto,
    pcryptoService,
    getOrderedMemberIds,
    collectPcryptoUsers,
    pickRoomBlock,
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
  const sendGroupMessage = async (
    chatId: string,
    room: MxRoom,
    text: string,
    extraContent?: Record<string, unknown>
  ) => {
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
    assertRecipientsHaveKeys(memberIds, users, myMatrixId)

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
    return matrixService.sendEncryptedTextMessage(
      chatId,
      { body: bodyHex, hash, block },
      extraContent
    )
  }

  /**
   * Отправка личного (1:1) текста через pcrypto (E2E) — как медиа и группы.
   *
   * P0-2: раньше тет-а-тет шёл сырым `m.text` (открытый текст оседал на
   * homeserver'е matrix.pocketnet.app — разрыв E2E-гарантии). Теперь шифруем так
   * же, как forta.chat `encryptEvent` для tetatet: per-user AES-SIV (ECDH по
   * ключам мессенджера участников), результат — Base64(JSON map) в `body`.
   */
  const sendDirectEncryptedText = async (
    chatId: string,
    room: MxRoom,
    text: string,
    extraContent?: Record<string, unknown>
  ) => {
    await room.loadMembersIfNeeded?.()

    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()
    if (!pcryptoService.value) throw new Error('PcryptoService not initialized')

    const memberIds = getOrderedMemberIds(room, Date.now())
    const users = await collectPcryptoUsers(memberIds)
    assertRecipientsHaveKeys(memberIds, users)
    const block = await pickRoomBlock(room)
    const version = 2

    const secrets = await pcryptoService.value.encryptKey(text, users, block, version)
    return matrixService.sendEncryptedDirectMessage(
      chatId,
      { body: secrets.keys, block: secrets.block, version },
      extraContent
    )
  }

  /**
   * Базовая отправка текста: тет-а-тет → per-user pcrypto (E2E), группа →
   * протокол общего ключа. Сырой `m.text` не отправляется НИКОГДА (см. P0-2).
   * `extraContent` — relation-метаданные (m.relates_to для ответа) подмешиваются
   * во внешний (открытый) content зашифрованного сообщения.
   */
  const sendTextContent = async (
    chatId: string,
    text: string,
    extraContent?: Record<string, unknown>
  ) => {
    // Если нас лишь пригласили в комнату — вступаем перед отправкой, иначе
    // Matrix вернёт M_FORBIDDEN («not in room»). Идемпотентно для joined-комнат.
    await matrixService.joinIfInvited(chatId)
    const room = matrixService.getRoom(chatId)
    // Без комнаты шифрование невозможно (нет участников/ключей). Не деградируем к
    // открытому тексту — бросаем, как это делает и медиа-путь.
    if (!room) throw new Error('Room not found')
    if (!isTetatetchat(room)) {
      return sendGroupMessage(chatId, room, text, extraContent)
    }
    return sendDirectEncryptedText(chatId, room, text, extraContent)
  }

  /**
   * Отправка текста с локальным эхо. Поле ввода очищается сразу, поэтому без
   * эхо неудачная отправка просто теряла текст: статус всегда был `sent`,
   * ошибка уходила в консоль, повторить было нечем (S35).
   */
  const sendMessage = async (chatId: string, text: string) => {
    const tempId = makeTempId()
    const optimistic: Message = {
      id: tempId,
      chatId,
      senderId: ctx.currentUser.value.id,
      senderName: ctx.currentUser.value.name,
      text,
      type: 'text',
      rawContent: null,
      timestamp: Date.now(),
      read: true,
      status: 'sending',
    }
    pushOptimistic(messages, chatId, optimistic)

    try {
      await sendTextContent(chatId, text)
      // Реальное событие придёт по таймлайну — эхо снимаем.
      removeOptimistic(messages, chatId, tempId)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки сообщения:', e)
      const failed = messages[chatId]?.find((m) => m.id === tempId)
      if (failed) failed.status = 'failed'
      // У собеседника нет опубликованных ключей — объясняем, иначе повтор
      // будет так же бесполезен (S39).
      if (e instanceof RecipientKeysMissingError) {
        appToast.error({ message: t('appMsg.messenger.recipientNoKeys') })
      }
    }
  }

  /**
   * Повторная отправка сообщения, которое не ушло. Текст берём из самого
   * неудавшегося эхо, так что второй транзакции/дубля не возникает (S35).
   */
  const retryMessage = async (chatId: string, messageId: string) => {
    const list = messages[chatId]
    const failed = list?.find((m) => m.id === messageId)
    if (!failed || failed.status !== 'failed' || failed.type !== 'text') return
    failed.status = 'sending'
    try {
      await sendTextContent(chatId, failed.text)
      removeOptimistic(messages, chatId, messageId)
    } catch (e) {
      console.error('[ChatStore] Повтор отправки не удался:', e)
      const again = messages[chatId]?.find((m) => m.id === messageId)
      if (again) again.status = 'failed'
    }
  }

  /**
   * Ответ на сообщение (Matrix m.in_reply_to). Тело шифруется как обычное
   * сообщение; добавляется только non-sensitive relation с event_id оригинала.
   */
  const replyToMessage = async (chatId: string, text: string, replyToEventId: string) => {
    try {
      await sendTextContent(chatId, text, {
        'm.relates_to': { 'm.in_reply_to': { event_id: replyToEventId } },
      })
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки ответа:', e)
      throw e
    }
  }

  /** Удаление своего сообщения (redaction). Оптимистично убираем локально. */
  const deleteMessage = async (chatId: string, eventId: string) => {
    try {
      await matrixService.redactEvent(chatId, eventId, 'deleted')
      const list = messages[chatId]
      if (list) {
        const idx = list.findIndex((m) => m.id === eventId)
        if (idx !== -1) list.splice(idx, 1)
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка удаления сообщения:', e)
      throw e
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
        { getUnspents, filterAvailableUnspents, selectAndLockUnspents },
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
      const selected = selectAndLockUnspents(unspents, requiredAmount) // лок входов (S6)
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

      // Фаза 2: сообщение в комнату. С этого момента деньги уже ушли — любая
      // ошибка ниже НЕ должна приводить к повторной транзакции.
      const payload: SendPkoinPayload = {
        txid,
        amount,
        fromAddress,
        toAddress,
        message: messageText,
      }
      try {
        await matrixService.sendPkoinTransaction(chatId, payload)
      } catch (e) {
        console.error('[ChatStore] sendPkoin: tx sent, chat message failed:', e)
        throw new PkoinMessageDeliveryError(txid, payload, e)
      }

      return txid
    } catch (e) {
      console.error('[ChatStore] sendPkoin failed:', e)
      throw e
    }
  }

  /** Повтор только сообщения о переводе (после PkoinMessageDeliveryError). */
  const sendPkoinMessage = async (chatId: string, payload: SendPkoinPayload): Promise<void> => {
    await matrixService.sendPkoinTransaction(chatId, payload)
  }

  return {
    getDirectPartnerAddress,
    sendTextContent,
    sendMessage,
    retryMessage,
    replyToMessage,
    deleteMessage,
    sendReaction,
    sendPkoin,
    sendPkoinMessage,
  }
}

export type MessageSending = ReturnType<typeof useMessageSending>
