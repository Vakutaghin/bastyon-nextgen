<template>
  <SC_ChatRoomContainer ref="containerRef" :style="isDragging ? DRAG_STYLE : undefined">
    <!-- Чат с поддержкой: сведения о приложении одной кнопкой (закреплена над перепиской). -->
    <SupportReportBar
      v-if="!inviteMode && !pendingInvite && isSupportChat && activeRoomId"
      :chat-id="activeRoomId"
    />

    <!-- Растягивается до панели ввода: поле ввода внизу окна, как в переписке. -->
    <SC_InviteBody v-if="inviteMode">
      <SC_PartnerInfoCard>
        <SC_PartnerHeader>
          <SC_PartnerAvatar>
            <img
              v-if="partnerAvatar && !avatarLoadFailed"
              :src="partnerAvatar"
              :alt="t('messenger.partnerAvatarAlt', { name: partnerName })"
              @error="onAvatarError"
            />

            <span v-else class="avatar-fallback">{{ partnerInitial }}</span>
          </SC_PartnerAvatar>

          <SC_PartnerName>{{ partnerName }}</SC_PartnerName>
        </SC_PartnerHeader>

        <SC_PartnerStats>
          <SC_StatItem>
            <SC_StatLabel>{{ t('messenger.reputation') }}</SC_StatLabel>
            <SC_StatValue>{{ reputation }}</SC_StatValue>
          </SC_StatItem>

          <SC_StatItem>
            <SC_StatLabel>{{ t('messenger.subscribers') }}</SC_StatLabel>
            <SC_StatValue>{{ subscribersCount }}</SC_StatValue>
          </SC_StatItem>

          <SC_StatItem>
            <SC_StatLabel>{{ t('messenger.subscriptions') }}</SC_StatLabel>
            <SC_StatValue>{{ subscribesCount }}</SC_StatValue>
          </SC_StatItem>
        </SC_PartnerStats>
      </SC_PartnerInfoCard>

      <!-- Комната создаётся первым сообщением: пустой чат-приглашение у
           собеседника появлялся, даже если ему так ничего и не написали. -->
      <SC_FirstMessageHint>
        {{ t('messenger.firstMessageHint', { name: partnerName }) }}
      </SC_FirstMessageHint>
    </SC_InviteBody>

    <!-- Нас пригласили: принять или отклонить. До вступления ленты нет. -->
    <ChatInvite
      v-else-if="pendingInvite && activeRoomId"
      :chat-id="activeRoomId"
      :dialog="store.activeDialog"
      :inviter-id="pendingInvite.by"
    />

    <!-- Заставка — только пока показать нечего. Отправленное за это время
         встаёт в ленту внизу, история догружается над ним. -->
    <template v-else-if="isLoading && !messages?.length">
      <SC_ChatRoomLoader>
        <SC_ChatRoomSpinner />
        <SC_ChatRoomLoaderText>{{ t('messenger.loadingMessages') }}</SC_ChatRoomLoaderText>
      </SC_ChatRoomLoader>
    </template>

    <template v-else>
      <SC_SearchRow
        v-if="messages && messages.length > 0"
        :class="{ searching: !!searchQuery.trim() || searchActive || pickingSender }"
      >
        <!-- Узко — кнопки уходят второй строкой, полю остаётся место. -->
        <SC_SearchField>
          <SC_SearchIcon><SearchOutlined /></SC_SearchIcon>
          <!-- Ищем сообщения одного участника группы: «От: Боб ×». -->
          <SC_SenderChip
            v-if="searchSender && !pickingSender"
            data-testid="chat-search-sender-chip"
          >
            <span>{{ t('messenger.search.fromName', { name: senderName }) }}</span>
            <button
              type="button"
              data-testid="chat-search-sender-clear"
              :aria-label="t('messenger.search.allSenders')"
              :title="t('messenger.search.allSenders')"
              @click="clearSender"
            >
              <CloseOutlined />
            </button>
          </SC_SenderChip>
          <!-- Пока выбирают участника, поле ищет его по имени. -->
          <SC_SearchInput
            ref="searchInputRef"
            :value="pickingSender ? senderQuery : searchQuery"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            :role="pickingSender ? 'combobox' : undefined"
            :aria-expanded="pickingSender ? true : undefined"
            :aria-controls="pickingSender ? SENDER_LIST_ID : undefined"
            :aria-activedescendant="pickingSender ? senderActiveId : undefined"
            type="search"
            enterkeyhint="search"
            data-testid="chat-search"
            @input="onSearchInput"
            @keydown="onSearchKeydown"
            @blur="onSearchBlur"
          />
        </SC_SearchField>
        <SC_SearchTools>
          <!-- Найденное перебирается, лента остаётся на месте: «3 из 17», вверх — старше. -->
          <template v-if="searchActive">
            <SC_SearchCount data-testid="chat-search-count" aria-live="polite">{{
              searchCounter
            }}</SC_SearchCount>
            <SC_SearchNav
              type="button"
              data-testid="chat-search-older"
              :disabled="searchIndex >= searchHits.length - 1"
              :aria-label="t('messenger.search.older')"
              :title="t('messenger.search.older')"
              @click="searchOlder"
            >
              <CaretUpOutlined />
            </SC_SearchNav>
            <SC_SearchNav
              type="button"
              data-testid="chat-search-newer"
              :disabled="searchIndex <= 0"
              :aria-label="t('messenger.search.newer')"
              :title="t('messenger.search.newer')"
              @click="searchNewer"
            >
              <CaretDownOutlined />
            </SC_SearchNav>
          </template>
          <SC_SearchNav
            v-if="isGroupChat"
            type="button"
            data-testid="chat-search-sender"
            :class="{ on: pickingSender || !!searchSender }"
            :aria-pressed="pickingSender"
            :aria-label="t('messenger.search.sender')"
            :title="t('messenger.search.sender')"
            @mousedown.prevent
            @click="toggleSenderPicker"
          >
            <UserOutlined />
          </SC_SearchNav>
          <DateJumpButton :min="dateMin" :max="dateMax" @pick="jumpToDate" />
          <!-- Здесь именно «скрыть сообщения» (matrix-ignore), а не блокировка в
             социальном графе: она живёт в профиле и дополнительно глушит чат
             (решение Р3, S43). В группе кнопка скрывала бы случайного
             участника — там это делается в списке участников. -->
          <Popconfirm
            v-if="!isGroupChat"
            :title="isBlocked ? t('messenger.unmuteConfirmTitle') : t('messenger.muteConfirmTitle')"
            :description="t('messenger.muteExplain')"
            :ok-text="isBlocked ? t('messenger.unmuteUser') : t('messenger.muteUser')"
            :cancel-text="t('messenger.cancel')"
            placement="bottomRight"
            :overlay-style="BLOCK_CONFIRM_OVERLAY_STYLE"
            @confirm="toggleBlock"
          >
            <SC_BlockBtn
              type="button"
              :class="{ blocked: isBlocked }"
              :title="isBlocked ? t('messenger.unmuteUser') : t('messenger.muteUser')"
              :disabled="blockBusy"
            >
              <StopOutlined />
            </SC_BlockBtn>
          </Popconfirm>
        </SC_SearchTools>
      </SC_SearchRow>

      <SenderPicker
        v-if="pickingSender"
        ref="senderPickerRef"
        :list-id="SENDER_LIST_ID"
        :room-id="activeRoomId"
        :query="senderQuery"
        @pick="onPickSender"
      />

      <!-- Как идёт переход (по цитате, к дате) и поиск глубже загруженного. -->
      <SC_SearchStatus v-if="statusLine" role="status" data-testid="chat-search-status">
        <span>{{ statusLine.text }}</span>
        <SC_SearchStatusAction
          v-if="statusLine.action"
          type="button"
          data-testid="chat-search-action"
          @click="statusLine.action.run"
        >
          {{ statusLine.action.label }}
        </SC_SearchStatusAction>
      </SC_SearchStatus>

      <!-- Ключи шифрования собеседника отличаются от закреплённых при первом
           контакте (TOFU, аудит P3-3): возможная подмена нодой. Показываем,
           пока пользователь явно не примет новые ключи. -->
      <SC_KeyChangedBanner v-if="partnerKeyChanged" role="alert">
        <SC_KeyChangedText>{{ t('messenger.keyChangedBanner') }}</SC_KeyChangedText>
        <SC_KeyChangedAccept type="button" @click="acceptPartnerKeys">
          {{ t('messenger.keyChangedAccept') }}
        </SC_KeyChangedAccept>
      </SC_KeyChangedBanner>

      <!-- Пустой чат: почему — кто и когда его создал, стёр ли сервер переписку. -->
      <ChatHistoryNote
        v-if="!messages || messages.length === 0"
        :history="store.activeHistory"
        empty
        @retry="retryHistory"
      />

      <MessageList
        ref="listRef"
        :messages="messages"
        :seen-ids="seenIds"
        :history="store.activeHistory"
        :loading="isLoading"
        :selection="selection"
        :focus-id="searchCurrentId"
        :highlight="searchTokens"
        :flash-id="jumpFlashId"
        :return-id="jumpReturnTo"
        quote-links
        @load-more="emit('load-more')"
        @reply="onReplyTo"
        @retry="retryHistory"
        @open-reply="jump.toReply"
        @back="jump.back"
        @returned="jump.forgetReturn"
      />
    </template>

    <SC_ReplyBanner v-if="replyingTo && !selection.active" data-testid="reply-banner">
      <SC_ReplyBannerBar />
      <SC_ReplyBannerBody>
        <SC_ReplyBannerTitle>
          {{ t('messenger.replyingTo') }} {{ replyPreviewName }}
        </SC_ReplyBannerTitle>
        <SC_ReplyBannerText>{{ replyPreviewText }}</SC_ReplyBannerText>
      </SC_ReplyBannerBody>
      <SC_ReplyBannerClose type="button" :aria-label="t('messenger.cancel')" @click="cancelReply">
        ×
      </SC_ReplyBannerClose>
    </SC_ReplyBanner>

    <!-- Записывает голосовое — важнее, чем «печатает»: показываем его. -->
    <SC_TypingIndicator v-if="recordingName" data-testid="recording-indicator">
      {{ t('messenger.recordingNamed', { name: recordingName }) }}
    </SC_TypingIndicator>
    <SC_TypingIndicator v-else-if="isTyping">
      {{ typingName ? t('messenger.typingNamed', { name: typingName }) : t('messenger.typing') }}
    </SC_TypingIndicator>

    <MeshRouteBar
      v-if="meshRoute && !inviteMode"
      :route="meshRoute"
      @toggle="activeRoomId && store.toggleMeshRoute(activeRoomId)"
    />

    <!-- Выделены сообщения — вместо поля ввода их действия, как в Telegram. -->
    <MessageSelectionBar
      v-if="selection.active && !pendingInvite"
      :selection="selection"
      :messages="messages"
      @reply="onReplyTo"
    />

    <!-- Спрятано, а не убрано: черновик, высота поля и диктовка остаются. -->
    <SC_ChatInputBar v-if="!pendingInvite" v-show="!selection.active" ref="inputAreaRef">
      <!-- RECORDING STATE: с первого касания, не дожидаясь микрофона. -->
      <template v-if="isRecording">
        <SC_RecordingTimer data-testid="voice-timer" :class="{ live: isCapturing }">{{
          recordingDuration
        }}</SC_RecordingTimer>

        <template v-if="isLocked">
          <SC_CancelButton @click="cancelRecording">{{ t('messenger.cancel') }}</SC_CancelButton>

          <SC_SendButton :aria-label="t('messenger.sendVoiceMessage')" @click="stopRecording">
            <SendOutlined />
          </SC_SendButton>
        </template>

        <!-- Подсказки едут за пальцем: --voice-* на панели ставит use-voice-recording. -->
        <template v-else>
          <SC_SwipeHint>
            <LeftOutlined />
            <span>{{ t('messenger.slideToCancel') }}</span>
          </SC_SwipeHint>
          <SC_LockHint data-testid="voice-lock-hint" :title="t('messenger.slideToLock')">
            <LockOutlined />
            <UpOutlined />
          </SC_LockHint>
        </template>
      </template>

      <!-- NORMAL STATE -->
      <template v-else>
        <EmojiPicker v-if="showEmojiPicker" @select="onEmojiSelect" />

        <!-- До первого сообщения комнаты нет: файлы, PKOIN и голосовые — после него. -->
        <SC_InputSlot v-if="!inviteMode">
          <AttachmentPanel
            :can-send-pkoin="canSendPkoin"
            :can-send-ipfs="canSendIpfs"
            :can-share-mesh="canShareMesh"
            @pick-files="handlePickFiles"
            @pick-pkoin="openPkoinModal"
            @pick-ipfs="sendViaIpfs"
            @pick-mesh="shareMeshAddress"
          />
        </SC_InputSlot>

        <SC_MessageInput
          ref="inputRef"
          v-model="inputValue"
          :placeholder="t('messenger.inputPlaceholder')"
          :aria-label="t('messenger.inputPlaceholder')"
          rows="1"
          enterkeyhint="send"
          @keydown="handleKeydown"
          @input="handleInput"
        />

        <SC_InputSlot>
          <SC_EmojiToggleButton
            type="button"
            :aria-label="t('messenger.openEmojiPicker')"
            :aria-expanded="showEmojiPicker"
            @click="toggleEmojiPicker"
          >
            <SmileOutlined />
          </SC_EmojiToggleButton>
        </SC_InputSlot>

        <!-- Голосовой ввод текстом (не голосовое сообщение — оно у микрофона справа). -->
        <SC_InputSlot>
          <VoiceInputButton
            ref="dictationRef"
            :get-element="getInputEl"
            :language="String(locale)"
          />
        </SC_InputSlot>
      </template>

      <!-- VOICE BUTTON (видна при записи или когда input пуст). Жест — pointer
           events; mousedown и touchstart гасим, чтобы поле не теряло фокус и
           клавиатура телефона не пряталась. С клавиатуры — запись с замком. -->
      <SC_VoiceButton
        v-if="!inviteMode && !inputValue.trim() && !isLocked"
        :class="{ recording: isRecording }"
        :aria-label="
          isRecording ? t('messenger.recordingInProgress') : t('messenger.recordVoiceMessage')
        "
        @pointerenter="warmUpMic"
        @pointerdown="onPressStart"
        @mousedown.prevent
        @touchstart.prevent
        @contextmenu.prevent
        @keydown.enter.prevent="startLocked"
        @keydown.space.prevent="startLocked"
      >
        <MicIcon />
      </SC_VoiceButton>

      <SC_HoldHint v-if="holdHint && !isRecording" role="status">
        {{ t('messenger.holdToRecord') }}
      </SC_HoldHint>

      <!-- TEXT SEND BUTTON (виден когда есть текст и не идёт запись). -->
      <SC_SendButton
        v-if="inputValue.trim() && !isRecording && !isLocked"
        :disabled="!inputValue.trim() || creatingChat"
        :aria-label="t('messenger.sendMessage')"
        :title="t('messenger.sendHint')"
        @click="handleSend"
      >
        <SendOutlined />
      </SC_SendButton>
    </SC_ChatInputBar>

    <PkoinTransferModal
      v-if="pkoinPartnerAddress"
      :open="pkoinModalOpen"
      :chat-id="activeChatIdForPkoin"
      :to-address="pkoinPartnerAddress"
      @close="closePkoinModal"
      @sent="onPkoinSent"
    />
  </SC_ChatRoomContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CaretDownOutlined,
  CaretUpOutlined,
  CloseOutlined,
  LeftOutlined,
  LockOutlined,
  MicIcon,
  SearchOutlined,
  SendOutlined,
  SmileOutlined,
  StopOutlined,
  UpOutlined,
  UserOutlined,
} from '@/components/icons'
import { Popconfirm } from 'ant-design-vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { debugLog } from '@/helpers/common/debug-log'
import { formatLongDate } from '@/helpers/common/date-formatter'
import { appToast } from '@/b-components/app-toast'
import type { Message } from '../../types'
import { matrixService } from '../../services/matrix-service'
import { useMessengerUiStore } from '../../store/messenger-ui-store'
import { useMessengerChatStore } from '../../store/messenger-chat-store'
import { useMessengerArchiveStore } from '../../store/messenger-archive-store'
import { useRoomSearch } from './use-room-search'
import { useHistorySearch } from './use-history-search'
import { useChatJump } from './use-chat-jump'
import DateJumpButton from './date-jump-button.vue'
import SenderPicker from './sender-picker.vue'
import { useTypingIndicator } from './use-typing-indicator'
import { useReadReceipts } from './use-read-receipts'
import { useBlockUser } from './use-block-user'
import MessageList from '../message-list/message-list.vue'
import { useMessageSelection } from '../message-list/use-message-selection'
import MessageSelectionBar from '../message-selection-bar/message-selection-bar.vue'
import ChatHistoryNote from '../chat-history-note/chat-history-note.vue'
import ChatInvite from '../chat-invite/chat-invite.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import VoiceInputButton from '@/b-components/voice-input/voice-input-button.vue'
import AttachmentPanel from '../attachment-panel/attachment-panel.vue'
import PkoinTransferModal from '../pkoin-transfer-modal/pkoin-transfer-modal.vue'
import { useMessengerStore } from '../../store'
import { chatUserName } from '../../helpers'
import { useMessengerProfileCache } from '../../store/messenger-profile-cache'
import { usePasteDrop } from './use-paste-drop'
import { useVoiceRecording, warmUpMic } from './use-voice-recording'
import { usePartnerInfo } from './use-partner-info'
import { useChatInput } from './use-chat-input'
import { useIpfsSend } from './use-ipfs-send'
import { useMeshShare } from './use-mesh-share'
import MeshRouteBar from './mesh-route-bar.vue'
import SupportReportBar from '../support-report/support-report-bar.vue'
import { useSupportChat } from '../support-report/use-support-chat'
import { supportReportPreview } from '../../lib/support-report-preview'
import { tooLargeForChat } from './too-large-for-chat'
import { useCloseOnBack } from '@/composables/use-back-button'
import { useRecordingBroadcast, useRecordingIndicator } from './use-recording-signal'
import { useMessengerPrivacyStore } from '../../store/messenger-privacy-store'
import {
  SC_ChatRoomContainer,
  SC_PartnerStats,
  SC_ChatInputBar,
  SC_InputSlot,
  SC_MessageInput,
  SC_SendButton,
  SC_EmojiToggleButton,
  SC_VoiceButton,
  SC_RecordingTimer,
  SC_SwipeHint,
  SC_LockHint,
  SC_HoldHint,
  SC_CancelButton,
  SC_FirstMessageHint,
  SC_InviteBody,
  SC_PartnerHeader,
  SC_PartnerAvatar,
  SC_PartnerName,
  SC_PartnerInfoCard,
  SC_ChatRoomLoader,
  SC_ChatRoomSpinner,
  SC_ChatRoomLoaderText,
  SC_TypingIndicator,
  SC_SearchRow,
  SC_SearchField,
  SC_SearchTools,
  SC_SearchIcon,
  SC_SearchInput,
  SC_SearchCount,
  SC_SearchNav,
  SC_SearchStatus,
  SC_SearchStatusAction,
  SC_SenderChip,
  SC_BlockBtn,
  SC_ReplyBanner,
  SC_ReplyBannerBar,
  SC_ReplyBannerBody,
  SC_ReplyBannerTitle,
  SC_ReplyBannerText,
  SC_ReplyBannerClose,
  SC_KeyChangedBanner,
  SC_KeyChangedText,
  SC_KeyChangedAccept,
} from './styled'
import {
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
} from '@/b-components/profile/profile-sidebar/styled'

// Inline style на dragover — выделение dashed-обводкой. Используется через
// :style биндинг, не плодит регрессию (значение из объекта, не литерал).
const DRAG_STYLE = {
  outline: '2px dashed var(--ui-primary)',
  outlineOffset: '-4px',
  background: 'rgb(var(--ui-primary-rgb) / 6%)',
}

// Поповер подтверждения блокировки рендерится в body; мессенджер-обёртка имеет
// z-index 2500, а дефолтный z-index ant-поповера ниже — поэтому поднимаем его.
// Ширина — фиксированная и с зазором до краёв экрана. Без неё длинное пояснение
// растягивало поповер во всю ширину: на узком полноэкранном виджете он упирался
// в края, ant сдвигал его, ширина менялась — и он бесконечно перестраивался.
const BLOCK_CONFIRM_OVERLAY_STYLE = {
  zIndex: Z_INDEX.REACTION_PICKER,
  width: 'min(280px, calc(100vw - 24px))',
}

const props = withDefaults(
  defineProps<{
    messages: Message[]
    /** Режим приглашения: карточка + «Начать чат». Только при открытии из профиля/поста. */
    inviteMode?: boolean
    /** Загрузка сообщений диалога (показываем прелоадер вместо списка). */
    isLoading?: boolean
    /** Окно чата на компьютере: курсор сразу в поле ввода. На телефоне — нет, иначе выскочит клавиатура. */
    focusOnOpen?: boolean
  }>(),
  { inviteMode: false, isLoading: false, focusOnOpen: false }
)

const emit = defineEmits<{
  send: [text: string]
  'load-more': []
}>()

const store = useMessengerStore()
const chatStore = useMessengerChatStore()
const uiStore = useMessengerUiStore()
const { t, locale } = useI18n()

// Активная комната + typing-индикатор собеседника.
const activeRoomId = computed<string | null>(() => uiStore.activeChatId)
const isGroupChat = computed<boolean>(() => !!store.activeDialog?.group)
const privacy = useMessengerPrivacyStore()
// Приглашение, ещё не принятое: из списка или, если списка ещё нет, из комнаты.
const pendingInvite = computed<{ by: string } | null>(() => {
  if (props.inviteMode) return null
  // «Принимать сразу»: пока чат вступает, вместо окна — загрузка ленты.
  if (privacy.prefs.acceptInvites && uiStore.isMessagesLoading) return null
  const invite = store.activeDialog?.invite
  if (invite) return invite
  const by = store.activeHistory?.invitedBy
  return by ? { by } : null
})
const { isTyping, typingName } = useTypingIndicator(activeRoomId)
const { recordingName } = useRecordingIndicator(activeRoomId)
const { seenIds } = useReadReceipts(activeRoomId)
const { isBlocked, busy: blockBusy, toggleBlock } = useBlockUser(activeRoomId)

// --- Поиск по переписке (use-room-search, use-history-search) ---
const listRef = ref<InstanceType<typeof MessageList> | null>(null)
const archiveStore = useMessengerArchiveStore()
let historySearch: ReturnType<typeof useHistorySearch> | null = null
/** Своё сообщение: Matrix id или «me» у только что отправленного. */
const isOwn = (m: Message): boolean => m.senderId === 'me' || m.senderId === store.currentUser.id
const roomSearch = useRoomSearch({
  messages: () => props.messages,
  extra: () => historySearch?.found.value ?? [],
  reveal: async (id) => (await listRef.value?.scrollToMessage?.(id)) ?? false,
  load: (message) =>
    activeRoomId.value
      ? chatStore.revealMessage(activeRoomId.value, message, () => !roomSearch.active.value)
      : Promise.resolve(false),
  fromSender: (m, who) => m.senderId === who || (who === store.currentUser.id && isOwn(m)),
})
historySearch = useHistorySearch({
  chatId: () => activeRoomId.value,
  active: () => roomSearch.active.value && !props.inviteMode && !pendingInvite.value,
  scan: (id) => chatStore.scanHistory(id),
  readArchive: (id) => archiveStore.readChat(id),
})
const {
  query: searchQuery,
  tokens: searchTokens,
  active: searchActive,
  hits: searchHits,
  index: searchIndex,
  currentId: searchCurrentId,
  older: searchOlder,
  newer: searchNewer,
  clear: clearSearch,
  sender: searchSender,
} = roomSearch
const deep = historySearch

// --- Сообщения одного участника группы (sender-picker) ---
const SENDER_LIST_ID = `chat-senders-${useId()}`
/** Выбирают участника: поле поиска ищет его по имени, под строкой — список. */
const pickingSender = ref(false)
const senderQuery = ref('')
const senderPickerRef = ref<InstanceType<typeof SenderPicker> | null>(null)
const searchInputRef = ref<{ $el?: HTMLInputElement } | null>(null)
const senderActiveId = computed<string | undefined>(() => senderPickerRef.value?.activeId)
/** Имя выбранного — как в списке участников, когда его выбрали. */
const senderName = ref('')
const searchPlaceholder = computed<string>(() =>
  pickingSender.value ? t('messenger.search.senderPlaceholder') : t('messenger.searchPlaceholder')
)

function focusSearch(): void {
  void nextTick(() => searchInputRef.value?.$el?.focus())
}
function stopPickingSender(): void {
  pickingSender.value = false
  senderQuery.value = ''
}
function toggleSenderPicker(): void {
  if (pickingSender.value) stopPickingSender()
  else pickingSender.value = true
  focusSearch()
}
function onPickSender(id: string, name: string): void {
  stopPickingSender()
  senderName.value = name
  roomSearch.setSender(id)
  focusSearch()
}
function clearSender(): void {
  roomSearch.setSender(null)
  focusSearch()
}
function onSearchInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  if (pickingSender.value) senderQuery.value = value
  else searchQuery.value = value
}
/** Ушли из поля — список участников закрывается (его варианты фокус не берут). */
function onSearchBlur(): void {
  if (pickingSender.value) stopPickingSender()
}

// --- Переходы: по цитате ответа, к дате (use-chat-jump) ---
const jump = useChatJump({
  chatId: () => activeRoomId.value,
  messages: () => props.messages,
  reveal: async (id) => (await listRef.value?.scrollToMessage?.(id)) ?? false,
  load: (chatId, target, stop) => chatStore.revealMessage(chatId, target, stop),
  loadDate: (chatId, at, stop) => chatStore.revealDate(chatId, at, stop),
  timeOf: (chatId, id) => chatStore.messageTime(chatId, id),
  missing: (why) =>
    appToast.info({
      message: t(why === 'deleted' ? 'messenger.jump.deleted' : 'messenger.jump.gone'),
    }),
})
const { flashId: jumpFlashId, returnTo: jumpReturnTo } = jump
function jumpToDate(at: number): void {
  void jump.toDate(at)
}

/** День в формате поля даты (YYYY-MM-DD), по местному времени. */
function dayValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// Календарь — от создания чата (если известно) до сегодня; пересчёт — при смене чата.
const dateMax = computed<string>(() => {
  void activeRoomId.value
  return dayValue(Date.now())
})
const dateMin = computed<string | undefined>(() => {
  const at = store.activeHistory?.createdAt
  return at ? dayValue(at) : undefined
})

/** «3 из 17»; пока история ещё читается — «3 из 17+». */
const searchCounter = computed<string>(() => {
  const total = searchHits.value.length
  if (!total) {
    return deep.scanning.value ? t('messenger.search.searching') : t('messenger.search.nothing')
  }
  const key = deep.scanning.value ? 'messenger.search.counterMore' : 'messenger.search.counter'
  return t(key, { n: searchIndex.value + 1, total })
})

/** Строка под поиском: что с историей глубже ленты и что можно сделать. */
const searchStatus = computed<{
  text: string
  action?: { label: string; run: () => void }
} | null>(() => {
  if (roomSearch.opening.value) return { text: t('messenger.search.opening') }
  if (deep.failed.value) {
    return {
      text: t('messenger.search.failed'),
      action: { label: t('messenger.search.retry'), run: deep.resume },
    }
  }
  // Остановили — сразу так и пишем, даже если последняя страница ещё в пути.
  if (deep.stopped.value && !deep.done.value) {
    return {
      text: t('messenger.search.stopped'),
      action: { label: t('messenger.search.resume'), run: deep.resume },
    }
  }
  if (deep.scanning.value) {
    const at = deep.reached.value
    return {
      text: at
        ? t('messenger.search.scanningTo', { date: formatLongDate(at) })
        : t('messenger.search.scanning'),
      action: { label: t('messenger.search.stop'), run: deep.stop },
    }
  }
  // Сервер стёр старое, а копии на устройстве нет — дальше искать негде.
  const chatId = activeRoomId.value
  if (deep.done.value && store.activeHistory?.purged && chatId && !archiveStore.hasCopy(chatId)) {
    return { text: t('messenger.search.serverLimit') }
  }
  return null
})

/** Строка под поиском: сначала переход (он идёт сейчас), потом поиск в истории. */
const statusLine = computed<typeof searchStatus.value>(() => {
  const work = jump.work.value
  if (work) {
    return {
      text:
        work.kind === 'date'
          ? t('messenger.jump.toDate', { date: formatLongDate(work.at) })
          : t('messenger.jump.findingOriginal'),
      action: { label: t('messenger.search.stop'), run: jump.stop },
    }
  }
  return searchActive.value ? searchStatus.value : null
})

/**
 * Enter — старше, Shift+Enter — новее, Esc — сбросить поиск (а не закрыть
 * чат), Backspace в пустом поле — убрать участника. Пока выбирают участника:
 * стрелки — по списку, Enter — выбрать, Esc — закрыть список.
 */
function onSearchKeydown(e: KeyboardEvent): void {
  if (pickingSender.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      senderPickerRef.value?.move(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      senderPickerRef.value?.pickActive()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      stopPickingSender()
    }
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) searchNewer()
    else searchOlder()
  } else if (e.key === 'Escape' && (searchQuery.value || searchSender.value)) {
    e.preventDefault()
    e.stopPropagation()
    clearSearch()
  } else if (e.key === 'Backspace' && !searchQuery.value && searchSender.value) {
    e.preventDefault()
    roomSearch.setSender(null)
  }
}
// --- Ответ на сообщение (reply) ---
const replyingTo = ref<Message | null>(null)
const replyPreviewName = computed<string>(() => {
  const m = replyingTo.value
  if (!m) return ''
  if (m.senderId === 'me' || m.senderId === store.currentUser.id) return m.senderName || ''
  return chatUserName(m.senderId, store.userProfiles, m.senderName)
})
const replyPreviewText = computed<string>(() => {
  const m = replyingTo.value
  if (!m) return ''
  // Для медиа показываем тип-плейсхолдер, для текста — обрезанный текст.
  if (m.type && m.type !== 'text') return `[${m.type}]`
  return supportReportPreview(m.text || '') ?? (m.text || '').slice(0, 80)
})
function onReplyTo(message: Message): void {
  replyingTo.value = message
  focusInput()
}
function cancelReply(): void {
  replyingTo.value = null
}

// Выделение сообщений (message-list, message-selection-bar).
const selection = useMessageSelection()

// Сброс поиска, переходов, ответа и выделения при смене диалога.
watch(activeRoomId, () => {
  clearSearch()
  stopPickingSender()
  jump.reset()
  replyingTo.value = null
  selection.clear()
})

// Сообщение выбрали в поиске по всем чатам: когда лента этого чата собралась,
// встаём на нём с тем же запросом. После сброса выше — он для смены чата.
watch(
  () => [activeRoomId.value, uiStore.searchJump, props.isLoading] as const,
  async ([chatId, jump, loading]) => {
    if (!jump || jump.chatId !== chatId || loading || props.inviteMode) return
    uiStore.searchJump = null
    await nextTick()
    if (activeRoomId.value === jump.chatId) roomSearch.openAt(jump.query, jump.message)
  },
  { immediate: true, flush: 'post' }
)

// Отправка собственного typing-статуса (throttle: не чаще раза в 3с).
// «Показывать, что я печатаю» выключено в настройках — не шлём вовсе.
let lastTypingSent = 0
function notifyTyping(): void {
  const rid = activeRoomId.value
  if (!rid || !privacy.prefs.typing) return
  const now = Date.now()
  if (now - lastTypingSent > 3000) {
    lastTypingSent = now
    void matrixService.sendTyping(rid, true)
  }
}
function stopTyping(): void {
  const rid = activeRoomId.value
  if (!rid) return
  lastTypingSent = 0
  void matrixService.sendTyping(rid, false)
}

// Карточка собеседника в invite-режиме.
const {
  partnerName,
  partnerAvatar,
  partnerInitial,
  avatarLoadFailed,
  reputation,
  subscribersCount,
  subscribesCount,
  onAvatarError,
} = usePartnerInfo(store)

// Поле ввода + emoji-пикер.
const {
  inputValue,
  inputRef,
  showEmojiPicker,
  handleSend,
  handleKeydown,
  handleInput,
  toggleEmojiPicker,
  onEmojiSelect,
  focusInput,
  adjustHeight,
} = useChatInput({
  onSend: (text) => {
    stopTyping()
    // Сообщение ушло — голосовой ввод выключается без хвоста: дораспознанная
    // фраза и новые слова не начнут следующее сообщение сами.
    dictationRef.value?.cancel()
    if (props.inviteMode) {
      void sendFirstMessage(text)
      return
    }
    // Активен ответ — шлём как reply (m.in_reply_to) напрямую через стор и
    // сбрасываем баннер; обычная отправка идёт через @send родителю.
    if (replyingTo.value && store.activeChatId) {
      const replyId = replyingTo.value.id
      replyingTo.value = null
      void store.replyToMessage(store.activeChatId, text, replyId)
      return
    }
    emit('send', text)
  },
})

/** Поле ввода сообщения — для голосового ввода. */
function getInputEl(): HTMLTextAreaElement | null {
  return inputRef.value?.$el ?? null
}
const dictationRef = ref<InstanceType<typeof VoiceInputButton> | null>(null)

// Недописанное сообщение ждёт в своём чате: ушли к списку или в другой чат —
// текст на месте, когда вернулись. Только в памяти, до выхода из аккаунта:
// переписка шифруется, и черновик на диск не пишем.
const draftKey = (): string | null => (props.inviteMode ? null : activeRoomId.value)
const restoredDraft = draftKey() ? chatStore.drafts[draftKey()!] : undefined
if (restoredDraft) inputValue.value = restoredDraft
watch(inputValue, (value) => {
  const key = draftKey()
  if (!key) return
  if (value) chatStore.drafts[key] = value
  else delete chatStore.drafts[key]
})

onMounted(() => {
  // В окне чата на компьютере можно сразу печатать.
  if (props.focusOnOpen && uiStore.isOpen) focusInput()
  // Многострочный черновик — поле сразу нужной высоты.
  else if (restoredDraft) void nextTick(adjustHeight)
})

// Шлём typing-нотификацию, пока пользователь печатает в активной комнате.
watch(inputValue, (value) => {
  if (value) notifyTyping()
})

// Выключили «печатает», пока набирали, — собеседнику сразу «перестал».
watch(
  () => privacy.prefs.typing,
  (on) => {
    if (!on && lastTypingSent) stopTyping()
  }
)

// Голосовая запись с touch-жестами.
const {
  isRecording,
  isCapturing,
  isLocked,
  recordingDuration,
  holdHint,
  onPressStart,
  startLocked,
  cancelRecording,
  stopRecording,
} = useVoiceRecording({
  currentChatId: () => store.activeChatId,
  onAudioRecorded: async (blob, duration, chatId) => {
    // Отправляем ИМЕННО в тот чат, где записывали (V28).
    if (chatId) {
      await store.sendAudio(chatId, blob, { duration, name: 'voice-message' })
    }
  },
})

// Пока записываете — собеседникам «записывает голосовое…», если не выключено в настройках.
// С ответа микрофона, а не с касания: короткое нажатие — не запись.
useRecordingBroadcast(activeRoomId, isCapturing, () => privacy.prefs.recording)

/** Первое сообщение новому собеседнику: создаётся комната, потом уходит текст. */
const creatingChat = ref(false)

async function sendFirstMessage(text: string): Promise<void> {
  if (creatingChat.value) return
  creatingChat.value = true
  try {
    // Не вышло (нет ключей у собеседника, нет связи) — текст возвращается в поле.
    if (!(await store.sendToNewChat(text))) inputValue.value = text
  } catch (e) {
    console.error('[ChatRoom] Failed to start chat room:', e)
    inputValue.value = text
  } finally {
    creatingChat.value = false
  }
}

function retryHistory(): void {
  if (activeRoomId.value) void store.loadMessages(activeRoomId.value)
}

// === Файлы: drag/drop, paste, кнопка-«скрепка». ===
const containerRef = ref<HTMLElement | null>(null)
const inputAreaRef = ref<HTMLElement | null>(null)

// Файл через IPFS — ссылкой в чат, как обычное сообщение.
const { available: canSendIpfs, sendViaIpfs } = useIpfsSend((text) => emit('send', text))
const { available: canShareMesh, shareAddress: shareMeshAddress } = useMeshShare(() =>
  activeRoomId.value ? store.shareMeshBinding(activeRoomId.value) : Promise.resolve('failed')
)
/** mesh-маршрут собеседника (он поделился адресом Reticulum). */
const meshRoute = computed(() => store.activeMeshRoute)

/**
 * Картинка уходит фото — уменьшенной до 2048 px. Выбранная через «Файл» —
 * файлом, в исходном размере (брошенная на чат и вставленная — фото).
 */
async function handlePickFiles(files: File[], options?: { asFile: boolean }): Promise<void> {
  // До принятия приглашения отправлять некуда: файл, брошенный на чат, не вступает за вас.
  if (!store.activeChatId || pendingInvite.value) return
  const asFile = options?.asFile === true
  for (const file of files) {
    if (tooLargeForChat(file, canSendIpfs, asFile)) continue
    if (!asFile && file.type.startsWith('image/')) {
      await store.sendImage(store.activeChatId, file, { name: file.name })
    } else {
      // Видео и прочие файлы отправляются как m.file — отдельный m.video отключён.
      await store.sendFile(store.activeChatId, file, { name: file.name })
    }
  }
}

const { isDragging, bindDropToRef, bindPasteToRef } = usePasteDrop({
  onMediaFiles: handlePickFiles,
  onOtherFiles: handlePickFiles,
})
bindDropToRef(containerRef)
bindPasteToRef(inputAreaRef)

// Пикер эмодзи закрывается щелчком мимо полосы ввода и клавишей Esc, а не
// только своей кнопкой. Esc при открытом пикере не уводит из чата.
function barEl(): HTMLElement | null {
  const v = inputAreaRef.value as HTMLElement | { $el?: HTMLElement } | null
  if (!v) return null
  return v instanceof HTMLElement ? v : (v.$el ?? null)
}
function onPointerOutsideBar(e: PointerEvent): void {
  const bar = barEl()
  if (bar && !bar.contains(e.target as Node)) showEmojiPicker.value = false
}
function onEmojiEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  showEmojiPicker.value = false
  focusInput()
}
function listenWhilePickerOpen(open: boolean): void {
  if (open) {
    document.addEventListener('pointerdown', onPointerOutsideBar, true)
    window.addEventListener('keydown', onEmojiEscape, true)
  } else {
    document.removeEventListener('pointerdown', onPointerOutsideBar, true)
    window.removeEventListener('keydown', onEmojiEscape, true)
  }
}
watch(showEmojiPicker, listenWhilePickerOpen)
onBeforeUnmount(() => listenWhilePickerOpen(false))
// «Назад» на Android закрывает пикер, а не чат — как Esc.
useCloseOnBack(showEmojiPicker, () => {
  showEmojiPicker.value = false
})

// === PKOIN-донат (только для личных чатов). ===
const activeChatIdForPkoin = computed<string>(() => store.activeChatId || '')
const pkoinPartnerAddress = computed<string | null>(() => {
  if (!store.activeChatId) return null
  return store.getDirectPartnerAddress(store.activeChatId)
})
const canSendPkoin = computed<boolean>(() => !!pkoinPartnerAddress.value)
const { isSupportChat } = useSupportChat(() => pkoinPartnerAddress.value)

// === Смена ключей собеседника (TOFU, P3-3). ===
const profileCache = useMessengerProfileCache()
const partnerKeyChanged = computed<boolean>(() => {
  const addr = pkoinPartnerAddress.value
  return !!addr && !!profileCache.changedKeyPeers[addr]
})
function acceptPartnerKeys(): void {
  if (pkoinPartnerAddress.value) profileCache.acceptChangedKeys(pkoinPartnerAddress.value)
}
const pkoinModalOpen = ref(false)

function openPkoinModal(): void {
  pkoinModalOpen.value = true
}
function closePkoinModal(): void {
  pkoinModalOpen.value = false
}
function onPkoinSent(txid: string): void {
  debugLog('[ChatRoom] PKOIN transaction sent:', txid)
}
</script>
