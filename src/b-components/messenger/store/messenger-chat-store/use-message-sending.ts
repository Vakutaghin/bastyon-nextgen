// Отправка текстовых сообщений (личных и групповых по протоколу общего ключа),
// реакций и PKOIN-донатов. Медиа-вложения — в use-media-sending.

import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { playSound } from '@/services/app-sounds'

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
import { markDeleted } from '../../lib/chat-history'
import { within } from '../../lib/within'
import { ROOM_WAIT_TIMEOUT, SEND_ORDER_WAIT } from '../consts'
import { groupCanBeEncrypted } from './encryption-rule'
import { pushOptimistic } from './media-sending-helpers'
import type { ChatContext, MxRoom } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import { localEchoId } from './use-local-echo'
import { createOutbox, releaseMediaUrls, type Outbox } from './outbox'
import { txnIdOf, txnState } from './txn-state'
import {
  pkoinTransferContent,
  pkoinTransferText,
  type SendPkoinPayload,
} from '../../lib/pkoin-transfer'

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

/**
 * Профиль собеседника с ключами не загрузился: нода не ответила. Опубликованы ли
 * ключи, неизвестно — повтор позже может пройти. Раньше это выдавалось за «нет
 * ключей», и человек просил собеседника зайти в приложение зря.
 */
export class RecipientProfilesUnavailableError extends Error {
  constructor(public readonly recipients: string[]) {
    super('recipient_profiles_unavailable')
    this.name = 'RecipientProfilesUnavailableError'
  }
}

export { groupCanBeEncrypted }

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
 * Проверяет, что у собеседника в личном чате есть ключи для шифрования.
 * `collectPcryptoUsers` молча пропускает тех, у кого в профиле нет `k`, и
 * сообщение уходило зашифрованным только для отправителя (S39). Профиль, который
 * не загрузился, — другая ошибка: ключи могут быть, нода не ответила.
 *
 * Только для личных чатов: в группе прежний клиент шифрует для тех, у кого
 * ключи есть, и отправку не останавливает (запрет `cantchat` у него тоже
 * только для личных).
 */
function assertRecipientsHaveKeys(
  memberIds: string[],
  users: { id: string }[],
  isUnresolved: (memberId: string) => boolean
): void {
  const withKeys = new Set(users.map((u) => u.id))
  const missing = memberIds.filter((id) => !withKeys.has(id))
  if (missing.length === 0) return
  const unresolved = missing.filter(isUnresolved)
  if (unresolved.length > 0) throw new RecipientProfilesUnavailableError(unresolved)
  throw new RecipientKeysMissingError(missing)
}

export function useMessageSending(
  ctx: ChatContext,
  chatCrypto: ChatCrypto,
  outbox: Outbox = createOutbox(ctx.messages)
) {
  const { messages, authStore, uiStore, profileCache } = ctx
  const {
    ensurePcryptoInitialized,
    waitForPcrypto,
    pcryptoService,
    getOrderedMemberIds,
    collectPcryptoUsers,
    pickRoomBlock,
    decryptionCache,
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

  /** Профиль участника не получен: запрос упал или не дождался ответа ноды. */
  const isUnresolvedMember = (memberId: string): boolean => {
    const address = getAddressFromMatrixId(memberId)
    return !!address && !!profileCache.isUnresolved?.(address)
  }

  /**
   * Ключи участников для шифрования. Профили, которые не загрузились, просим
   * ещё раз: в большой группе или под Tor за отведённое время приходят не все,
   * и участник выпадал из шифрования, как будто ключей у него нет.
   */
  const collectRecipients = async (memberIds: string[]) => {
    const users = await collectPcryptoUsers(memberIds)
    const withKeys = new Set(users.map((u) => u.id))
    const retry = memberIds.some((id) => !withKeys.has(id) && isUnresolvedMember(id))
    return retry ? collectPcryptoUsers(memberIds) : users
  }

  /**
   * Отправка группового зашифрованного сообщения по протоколу bastyon-chat:
   *   1) usershash = md5(<id участников кроме меня, сортировка по dbId>) + "_v13_2"
   *   2) ищем state-событие m.room.encryption со state_key `pcrypto.<my>.<hash>`;
   *      если есть — расшифровываем общий ключ; нет — генерируем и публикуем своё.
   *   3) AES-CBC шифруем тело общим ключом, отправляем m.room.message
   *      { msgtype: 'm.encrypted', body: hex, hash, block: 10 }.
   * Ключ — для участников с опубликованными ключами; у кого их нет, тот это
   * сообщение не прочтёт, но и писать в группу не мешает (как у прежнего клиента).
   */
  const sendGroupMessage = async (
    chatId: string,
    room: MxRoom,
    memberIds: string[],
    text: string,
    extraContent: Record<string, unknown> | undefined,
    txnId: string
  ) => {
    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()
    if (!pcryptoService.value) throw new Error('PcryptoService not initialized')

    const client = matrixService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    const myMatrixId = client.getUserId()
    if (!myMatrixId) throw new Error('Missing my matrix id')
    const myLocal = getMatrixId(myMatrixId)

    const users = await collectRecipients(memberIds)
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
    return matrixService.sendEncryptedTextMessage(
      chatId,
      { body: bodyHex, hash, block },
      extraContent,
      txnId
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
    extraContent: Record<string, unknown> | undefined,
    txnId: string
  ) => {
    await room.loadMembersIfNeeded?.()

    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()
    if (!pcryptoService.value) throw new Error('PcryptoService not initialized')

    const memberIds = getOrderedMemberIds(room, Date.now())
    const users = await collectRecipients(memberIds)
    assertRecipientsHaveKeys(memberIds, users, isUnresolvedMember)
    const block = await pickRoomBlock(room)
    const version = 2

    const secrets = await pcryptoService.value.encryptKey(text, users, block, version)
    return matrixService.sendEncryptedDirectMessage(
      chatId,
      { body: secrets.keys, block: secrets.block, version },
      extraContent,
      txnId
    )
  }

  /**
   * Комната для отправки. Чат открывается из списка прошлого запуска раньше,
   * чем клиент войдёт и узнает о комнатах, — и написанное сразу падало с
   * «Room not found». Ждём первого синка, как и загрузка истории.
   */
  const roomForSend = async (chatId: string): Promise<MxRoom | null> => {
    const deadline = Date.now() + ROOM_WAIT_TIMEOUT
    for (;;) {
      const room = matrixService.getRoom(chatId)
      if (room) return room
      const synced =
        !!matrixService.getClient() &&
        (uiStore.syncState === 'PREPARED' || uiStore.syncState === 'SYNCING')
      if (synced || Date.now() > deadline) return null
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  /** Хвост очереди отправки каждого чата. */
  const sendQueues = new Map<string, Promise<unknown>>()

  /**
   * Сообщения чата уходят по очереди — в том порядке, в каком их написали.
   * Шифрование у каждого своё по времени: без очереди второе, написанное
   * следом, могло обогнать первое. Зависшее не держит остальных дольше
   * SEND_ORDER_WAIT.
   */
  const inOrder = <T>(chatId: string, job: () => Promise<T>): Promise<T> => {
    const prev = sendQueues.get(chatId)
    const run = prev ? within(prev, SEND_ORDER_WAIT).then(job) : job()
    const tail = run.catch(() => {})
    sendQueues.set(chatId, tail)
    void tail.then(() => {
      if (sendQueues.get(chatId) === tail) sendQueues.delete(chatId)
    })
    return run
  }

  /**
   * Базовая отправка текста: тет-а-тет → per-user pcrypto (E2E), закрытая
   * группа до 50 участников → протокол общего ключа. Публичная или большая
   * группа → обычный `m.text`, как у прежнего клиента (`groupCanBeEncrypted`).
   * В личном чате сырой `m.text` не отправляется никогда (P0-2).
   * `extraContent` — relation-метаданные (m.relates_to для ответа) подмешиваются
   * во внешний (открытый) content зашифрованного сообщения.
   */
  const sendTextContent = async (
    chatId: string,
    text: string,
    extraContent?: Record<string, unknown>,
    txnId: string = matrixService.makeTxnId()
  ) => {
    await roomForSend(chatId)
    // Если нас лишь пригласили в комнату — вступаем перед отправкой, иначе
    // Matrix вернёт M_FORBIDDEN («not in room»). Идемпотентно для joined-комнат.
    await matrixService.joinIfInvited(chatId)
    const room = matrixService.getRoom(chatId)
    // Без комнаты шифрование невозможно (нет участников/ключей). Не деградируем к
    // открытому тексту — бросаем, как это делает и медиа-путь.
    if (!room) throw new Error('Room not found')
    const direct = isTetatetchat(room)
    let memberIds: string[] = []
    if (!direct) {
      await room.loadMembersIfNeeded?.()
      memberIds = getOrderedMemberIds(room, Date.now())
      if (!groupCanBeEncrypted(room, memberIds.length)) {
        return matrixService.sendMessage(chatId, text, extraContent, txnId)
      }
    }
    // Свой текст известен: копия события в ленте показывает его сразу, без
    // расшифровки. Иначе у первого сообщения группы (ключ комнаты приходит
    // синком позже отправки) вместо текста стояло «*** Encrypted Message ***».
    decryptionCache.set(localEchoId(chatId, txnId), text)
    const res = direct
      ? await sendDirectEncryptedText(chatId, room, text, extraContent, txnId)
      : await sendGroupMessage(chatId, room, memberIds, text, extraContent, txnId)
    const eventId = res?.event_id
    if (typeof eventId === 'string' && !decryptionCache.has(eventId)) {
      decryptionCache.set(eventId, text)
      decryptionCache.persist(matrixService.getClient()?.getUserId(), eventId, text)
    }
    return res
  }

  /**
   * Сообщение ушло: эхо получает настоящий id события, по нему его можно
   * ответить и удалить. Если SDK уже переименовал эхо или настоящее событие
   * пришло синком раньше, второе копией не остаётся.
   */
  const markSent = (chatId: string, localId: string, eventId: unknown) => {
    const list = messages[chatId]
    if (!list) return
    const idx = list.findIndex((m) => m.id === localId)
    const real = typeof eventId === 'string' ? list.find((m) => m.id === eventId) : undefined
    if (real) {
      real.status = 'sent'
      if (idx !== -1) list.splice(idx, 1)
      return
    }
    if (idx === -1) return
    if (typeof eventId === 'string') list[idx]!.id = eventId
    list[idx]!.status = 'sent'
  }

  /**
   * Отправка текста с локальным эхо. Поле ввода очищается сразу, поэтому без
   * эхо неудачная отправка просто теряла текст: статус всегда был `sent`,
   * ошибка уходила в консоль, повторить было нечем (S35).
   *
   * Id эхо — как у копии события в SDK (`~<комната>:<txnId>`): лента видит одно
   * сообщение. Раньше эхо снималось после отправки, а копия SDK оставалась со
   * своим id и при повторном открытии чата добавлялась к настоящему событию.
   */
  const sendMessage = async (chatId: string, text: string) => {
    const txnId = matrixService.makeTxnId()
    const localId = localEchoId(chatId, txnId)
    const optimistic: Message = {
      id: localId,
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
      const res = await inOrder(chatId, () => sendTextContent(chatId, text, undefined, txnId))
      markSent(chatId, localId, res?.event_id)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки сообщения:', e)
      const failed = messages[chatId]?.find((m) => m.id === localId)
      if (failed) {
        failed.status = 'failed'
        // Переживёт перезапуск: текст в поле ввода уже стёрт.
        void outbox.keep(failed)
      }
      // У собеседника нет опубликованных ключей — объясняем, иначе повтор
      // будет так же бесполезен (S39).
      if (e instanceof RecipientKeysMissingError) {
        appToast.error({ message: t('appMsg.messenger.recipientNoKeys') })
      } else if (e instanceof RecipientProfilesUnavailableError) {
        appToast.error({ message: t('appMsg.messenger.recipientKeysUnavailable') })
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

    // Запрос мог дойти до сервера, а оборваться только ответ. Повтор — с прежним
    // txnId (txn-state): сервер узнаёт транзакцию и возвращает то же событие.
    // Новая транзакция дала бы всем участникам дубль, навсегда.
    const prevTxn = txnIdOf(chatId, messageId)
    const state = prevTxn ? txnState(chatId, prevTxn) : ({ kind: 'unknown' } as const)
    if (state.kind === 'delivered') {
      markSent(chatId, messageId, state.eventId)
      void outbox.forget(messageId)
      return
    }
    // SDK ещё отправляет ту же копию: чем кончится, скажет Room.localEchoUpdated.
    if (state.kind === 'pending') return

    // Копия в SDK — повторяет сама себя; нет копии (перезапуск, ключи не
    // нашлись) — шифруем заново, но под тем же txnId.
    const txnId = prevTxn ?? matrixService.makeTxnId()
    const localId = localEchoId(chatId, txnId)
    failed.id = localId
    failed.status = 'sending'
    try {
      const res =
        state.kind === 'unsent'
          ? await state.resend()
          : await sendTextContent(chatId, failed.text, undefined, txnId)
      markSent(chatId, localId, res?.event_id)
      void outbox.forget(localId)
    } catch (e) {
      console.error('[ChatStore] Повтор отправки не удался:', e)
      const again = messages[chatId]?.find((m) => m.id === localId)
      if (again && again.status === 'sending') {
        again.status = 'failed'
        void outbox.keep(again)
      }
    } finally {
      // Id без txnId (старая запись) сменился: на устройстве оно лежало под прежним.
      if (localId !== messageId) void outbox.forget(messageId)
    }
  }

  /**
   * Удалить неотправленное: из ленты, с устройства и копию в SDK. На сервере
   * его нет, поэтому удаление — только здесь.
   */
  const discardMessage = async (chatId: string, messageId: string) => {
    const list = messages[chatId]
    const idx = list?.findIndex((m) => m.id === messageId) ?? -1
    const message = idx >= 0 ? list![idx] : undefined
    if (!message || message.status !== 'failed') return
    list!.splice(idx, 1)
    releaseMediaUrls(message)
    try {
      const txnId = txnIdOf(chatId, messageId)
      const state = txnId ? txnState(chatId, txnId) : null
      if (state?.kind === 'unsent') state.cancel()
    } catch (e) {
      console.warn('[ChatStore] Копию неотправленного в SDK не убрать:', e)
    }
    await outbox.forget(messageId)
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

  /**
   * Удаление у всех (redaction) — своего или, если права в комнате позволяют,
   * чужого: в ленте остаётся отметка «Вы удалили». Сообщение, которого на
   * сервере уже нет, стирается с устройства, а собеседникам уходит событие
   * lib/archive-redact — у кого есть копия, сотрётся и у них.
   */
  const deleteMessage = async (chatId: string, eventId: string) => {
    const localOnly = !!messages[chatId]?.find((m) => m.id === eventId)?.localOnly
    try {
      await matrixService.redactEvent(chatId, eventId, 'deleted')
    } catch (e) {
      if (!localOnly) {
        console.error('[ChatStore] Ошибка удаления сообщения:', e)
        throw e
      }
      // Сервер не знает этого события и не принял удаление — копии на устройстве это не мешает.
      console.warn('[ChatStore] Удаление сохранённого сообщения не дошло до сервера:', e)
    }
    if (localOnly) {
      // Удаление стёртого сервер собеседнику не отдаёт — для его копии своё событие.
      await matrixService.sendArchiveRedact(chatId, [eventId]).catch((e: unknown) => {
        console.warn('[ChatStore] Удаление не ушло в копии собеседников:', e)
      })
    }
    markDeleted(messages[chatId], eventId, { by: ctx.currentUser.value.id, at: Date.now() })
    await ctx.archive.remove(chatId, [eventId])
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
   * Сообщение о переводе — зашифрованное, как любой текст. Раньше оно уходило
   * сырым `m.text`: заметку к переводу сервер Matrix хранил открытым текстом.
   * Отдельно — и для повтора после PkoinMessageDeliveryError: второй
   * транзакции не будет.
   */
  const sendPkoinMessage = async (chatId: string, payload: SendPkoinPayload): Promise<void> => {
    await sendTextContent(
      chatId,
      pkoinTransferText(payload.amount, payload.message),
      pkoinTransferContent(payload)
    )
  }

  /**
   * Отправка PKOIN-доната в личный чат:
   *  1) собираем UTXO отправителя, выбираем подходящие;
   *  2) строим/подписываем транзакцию (buildTransferTransaction);
   *  3) шлём через sendrawtransactionwithmessage;
   *  4) пишем в комнату зашифрованное сообщение о переводе (sendPkoinMessage).
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
        { transferFee },
      ] = await Promise.all([
        import('@/blockchain/core/transactions/unspents-manager'),
        import('@/blockchain/core/transactions/transaction-builder'),
        import('@/blockchain/core/transactions/transaction-sender'),
        import('@/blockchain/core/transactions/transfer-fee'),
      ])

      const rawUnspents = await getUnspents(fromAddress, 1, 9999999)
      const unspents = filterAvailableUnspents(rawUnspents, false)
      // Комиссия перевода считается от размера: с одним сатоши сеть отвечает
      // -26. Сообщение в OP_RETURN не кладём, поэтому messageBytes нет.
      const estimatedFee = transferFee({ inputs: 1, outputs: 1 })
      const requiredAmount = amount + estimatedFee
      const selected = selectAndLockUnspents(unspents, requiredAmount) // лок входов (S6)
      if (!selected.length) throw new Error(t('appMsg.messenger.insufficientFunds'))

      const built = await buildTransferTransaction({
        unspents: selected,
        fromAddress,
        sourceAddresses: [fromAddress],
        keyPair,
        outputs: [{ address: toAddress, amount }],
        fee: transferFee({ inputs: selected.length, outputs: 1 }),
        // Заметка к переводу уходит собеседнику только в зашифрованном
        // сообщении чата ниже. В транзакцию её не кладём: сообщение перевода
        // пишется в OP_RETURN и стало бы публичным в блокчейне.
        message: '',
        feemode: 'exclude',
      })

      const txid = await sendTransactionWithMessage({
        hex: built.hex,
        messageData: built.messageData,
        operationType: 'transaction',
        pending: { address: toAddress, amount },
      })
      // Монеты ушли — даже если сообщение о переводе ниже не дойдёт.
      playSound('coin')

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
        await sendPkoinMessage(chatId, payload)
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

  return {
    getDirectPartnerAddress,
    sendTextContent,
    sendMessage,
    retryMessage,
    discardMessage,
    replyToMessage,
    deleteMessage,
    sendReaction,
    sendPkoin,
    sendPkoinMessage,
  }
}

export type MessageSending = ReturnType<typeof useMessageSending>
