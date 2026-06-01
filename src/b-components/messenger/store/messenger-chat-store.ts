// Логика комнат и сообщений мессенджера: загрузка, отправка, пагинация, реакции.
//
// Стор — тонкий композиционный корень: создаёт разделяемое состояние (messages,
// currentUser) и собирает доменные модули из ./messenger-chat-store/*. Публичный
// API сохранён 1-в-1 (потребители — messenger-store и Vue-компоненты — не меняются).
// Граф зависимостей модулей:
//   crypto → { decryption, media-transfer, sending, media-sending }
//   decryption → mapping → loading (loading также зависит от crypto)

import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { useAuthStore } from '@/blockchain'
import { t } from '@/i18n'

import type { Dialog, Message, User } from '../types'
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'

import type { ChatContext, MxRoom } from './messenger-chat-store/types'
import { useChatCrypto } from './messenger-chat-store/use-chat-crypto'
import { useMessageDecryption } from './messenger-chat-store/use-message-decryption'
import { useMessageMapping } from './messenger-chat-store/use-message-mapping'
import { useMessageLoading } from './messenger-chat-store/use-message-loading'
import { useMessageSending } from './messenger-chat-store/use-message-sending'
import { useMediaSending } from './messenger-chat-store/use-media-sending'
import { useMediaTransfer } from './messenger-chat-store/use-media-transfer'

export const useMessengerChatStore = defineStore('messenger-chat', () => {
  // --- Разделяемое состояние и зависимости ---
  const messages = reactive<Record<string, Message[]>>({})
  const currentUser = ref<User>({
    id: 'me',
    name: t('appMsg.messenger.me'),
    avatar: 'https://via.placeholder.com/150',
  })

  const ctx: ChatContext = {
    messages,
    currentUser,
    authStore: useAuthStore(),
    uiStore: useMessengerUiStore(),
    profileCache: useMessengerProfileCache(),
  }

  // --- Доменные модули (порядок = граф зависимостей) ---
  const chatCrypto = useChatCrypto(ctx)
  const decryption = useMessageDecryption(ctx, chatCrypto)
  const mapping = useMessageMapping(ctx, decryption)
  const loading = useMessageLoading(ctx, chatCrypto, mapping)
  const sending = useMessageSending(ctx, chatCrypto)
  const mediaSending = useMediaSending(ctx, chatCrypto)
  const mediaTransfer = useMediaTransfer(chatCrypto)

  /** Полный сброс при логауте. */
  const reset = () => {
    Object.keys(messages).forEach((key) => delete messages[key])
    currentUser.value = {
      id: 'me',
      name: t('appMsg.messenger.me'),
      avatar: 'https://via.placeholder.com/150',
    }
    chatCrypto.resetCrypto()
  }

  return {
    messages,
    currentUser,
    pcryptoService: chatCrypto.pcryptoService,
    localMessengerKeys: chatCrypto.localMessengerKeys,
    loadMessages: loading.loadMessages,
    loadMoreMessages: loading.loadMoreMessages,
    sendMessage: sending.sendMessage,
    sendReaction: sending.sendReaction,
    sendAudio: mediaSending.sendAudio,
    sendImage: mediaSending.sendImage,
    sendVideo: mediaSending.sendVideo,
    sendFile: mediaSending.sendFile,
    sendPkoin: sending.sendPkoin,
    getDirectPartnerAddress: sending.getDirectPartnerAddress,
    fetchAndDecryptMedia: mediaTransfer.fetchAndDecryptMedia,
    decryptAudioData: mediaTransfer.decryptAudioData,
    mapEventToMessage: mapping.mapEventToMessage,
    // будет заполнен из главного стора (mapRoomToDialog там типизирован как (room) => Promise<Dialog>)
    mapRoomToDialog: undefined as undefined | ((room: MxRoom) => Promise<Dialog>),
    enrichMessagesWithReactions: mapping.enrichMessagesWithReactions,
    ensurePcryptoInitialized: chatCrypto.ensurePcryptoInitialized,
    waitForPcrypto: chatCrypto.waitForPcrypto,
    hydrateDecryptedCache: chatCrypto.hydrateDecryptedCache,
    purgeDecryptedCache: chatCrypto.purgeDecryptedCache,
    getMatrixAvatarUrl: chatCrypto.getMatrixAvatarUrl,
    getOrderedMemberIds: chatCrypto.getOrderedMemberIds,
    collectPcryptoUsers: chatCrypto.collectPcryptoUsers,
    getCurrentBlockHeight: chatCrypto.getCurrentBlockHeight,
    reset,
  }
})
