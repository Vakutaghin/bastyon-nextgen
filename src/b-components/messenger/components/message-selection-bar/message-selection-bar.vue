<template>
  <SC_SelectionBar role="toolbar" :aria-label="countText" data-testid="selection-bar">
    <SC_SelectionButton
      type="button"
      class="close"
      data-testid="selection-cancel"
      :aria-label="t('messenger.selection.cancel')"
      :title="t('messenger.selection.cancel')"
      @click="selection.clear()"
    >
      <CloseOutlined />
    </SC_SelectionButton>
    <SC_SelectionCount aria-live="polite">{{ countText }}</SC_SelectionCount>

    <SC_SelectionButton
      v-if="replyTarget"
      type="button"
      data-testid="selection-reply"
      :aria-label="t('messenger.reply')"
      :title="t('messenger.reply')"
      @click="onReply"
    >
      <RollbackOutlined />
      <span class="selection-bar-label">{{ t('messenger.reply') }}</span>
    </SC_SelectionButton>
    <SC_SelectionButton
      type="button"
      data-testid="selection-copy"
      :aria-label="t('messenger.selection.copy')"
      :title="t('messenger.selection.copy')"
      @click="onCopy"
    >
      <CopyOutlined />
      <span class="selection-bar-label">{{ t('messenger.selection.copy') }}</span>
    </SC_SelectionButton>
    <SC_SelectionButton
      v-if="canDelete"
      type="button"
      class="danger"
      data-testid="selection-delete"
      :aria-label="t('messenger.deleteMessage')"
      :title="t('messenger.deleteMessage')"
      @click="onDelete"
    >
      <DeleteOutlined />
      <span class="selection-bar-label">{{ t('messenger.deleteMessage') }}</span>
    </SC_SelectionButton>
  </SC_SelectionBar>
</template>

<script setup lang="ts">
/**
 * Действия над выделенными сообщениями (lib/message-selection): «Ответить» —
 * когда выделено одно, «Копировать», «Удалить» — когда удалить можно все.
 * Esc и «Назад» снимают выделение, Ctrl+C копирует, Delete удаляет — пока
 * фокус не в поле ввода.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { CloseOutlined, CopyOutlined, DeleteOutlined, RollbackOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { copyText } from '@/helpers/common/clipboard'
import { formatDateTimeNumeric } from '@/helpers/common/date-formatter'
import { useCloseOnBack } from '@/composables/use-back-button'
import { Z_INDEX } from '@/styles/design-tokens'
import { isMeshTransport, type Message } from '../../types'
import { useMessengerStore } from '../../store'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../../store/consts'
import { chatUserName } from '../../helpers'
import { canDeleteAll, canReplyTo, selectionText } from '../../lib/message-selection'
import { plainMentions } from '../../lib/mentions'
import type { MessageSelection } from '../message-list/use-message-selection'
import { SC_SelectionBar, SC_SelectionButton, SC_SelectionCount } from './styled'

const props = defineProps<{
  selection: MessageSelection
  /** Лента, в которой выделяли, — порядок для копирования. */
  messages: Message[]
}>()

const emit = defineEmits<{ reply: [message: Message] }>()

const { t } = useI18n()
const store = useMessengerStore()

/** Выделенные — в порядке ленты; удалённые за это время уже не в счёт. */
const selected = computed<Message[]>(() =>
  props.messages.filter((m) => !m.deleted && props.selection.has(m.id))
)

const countText = computed(() =>
  t('messenger.selection.count', { n: props.selection.count }, props.selection.count)
)

function isMine(m: Message): boolean {
  return m.senderId === 'me' || m.senderId === store.currentUser.id
}

const replyTarget = computed<Message | null>(() => {
  const list = selected.value
  return list.length === 1 && canReplyTo(list[0]!) ? list[0]! : null
})

const canDelete = computed(() => canDeleteAll(selected.value, isMine, store.canDeleteOthers))

function onReply(): void {
  const target = replyTarget.value
  if (!target) return
  props.selection.clear()
  emit('reply', target)
}

// --- Копировать ---

function senderName(m: Message): string {
  if (isMine(m)) return store.currentUser.name || t('messenger.you')
  if (isMeshTransport(m.transport)) return m.senderName || t('mesh.chat.unknownSender')
  return chatUserName(m.senderId, store.userProfiles, m.senderName)
}

/** Текст сообщения; у вложений — что это, у файла — ещё и имя. */
function body(m: Message): string {
  if (m.text === ENCRYPTED_MESSAGE_PLACEHOLDER) return `[${t('messenger.history.undecryptable')}]`
  switch (m.type) {
    case 'image':
      return `[${t('messenger.notifyImage')}]`
    case 'video':
      return `[${t('messenger.notifyVideo')}]`
    case 'audio':
      return `[${t('messenger.notifyAudio')}]`
    case 'file': {
      const name = typeof m.info?.name === 'string' ? m.info.name : ''
      return `[${t('messenger.notifyFile')}]${name ? ` ${name}` : ''}`
    }
    default:
      // Упоминание — «@имя», а не hex адреса.
      return plainMentions(m.text || '', (address) => store.userProfiles[address]?.name)
  }
}

async function onCopy(): Promise<void> {
  const list = selected.value
  if (!list.length) return
  const text = selectionText(list, {
    name: senderName,
    time: (m) => formatDateTimeNumeric(m.timestamp),
    body,
  })
  if (await copyText(text)) {
    // Скопировали — выделение снято, как в Telegram.
    props.selection.clear()
    appToast.success({ message: t('messenger.selection.copied') })
  } else {
    appToast.error({ message: t('messenger.selection.copyFailed') })
  }
}

// --- Удалить ---

let confirmOpen = false

function confirmText(list: Message[]): string {
  if (list.length > 1) return t('messenger.selection.deleteText')
  const m = list[0]!
  if (m.localOnly) return t('messenger.archive.deleteLocalOnly')
  if (isMine(m)) return t('messenger.deleteConfirmText')
  return t('messenger.deleteOthersConfirmText', { name: senderName(m) })
}

function onDelete(): void {
  const list = [...selected.value]
  if (!list.length || !canDelete.value || confirmOpen) return
  const n = list.length
  confirmOpen = true
  Modal.confirm({
    title:
      n === 1 ? t('messenger.deleteConfirmTitle') : t('messenger.selection.deleteTitle', { n }, n),
    content: confirmText(list),
    okText: t('messenger.deleteMessage'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    // Над полноэкранным мессенджером.
    zIndex: Z_INDEX.CONFIRM,
    afterClose: () => {
      confirmOpen = false
    },
    // Окно закрывается сразу: удаления уходят по одному (у сервера предел
    // частоты, клиент Matrix ждёт и повторяет), сообщения исчезают по мере ответа.
    onOk: () => {
      props.selection.clear()
      void deleteAll(list)
    },
  })
}

async function deleteAll(list: Message[]): Promise<void> {
  let failed = 0
  for (const m of list) {
    try {
      await store.deleteMessage(m.chatId, m.id)
    } catch {
      failed += 1
    }
  }
  if (failed) {
    appToast.error({ message: t('messenger.selection.deleteFailed', { n: failed }, failed) })
  }
}

// --- Клавиши и «Назад» ---

function typingSomewhere(): boolean {
  const el = document.activeElement
  return !!el?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
}

function onKeydown(e: KeyboardEvent): void {
  // Открыт вопрос «Удалить?» — клавиши его.
  if (confirmOpen || e.isComposing) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    props.selection.clear()
    return
  }
  if (typingSomewhere()) return
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyC') {
    // Выделен кусок текста мышью — копируется он, как обычно.
    if (window.getSelection()?.toString()) return
    e.preventDefault()
    void onCopy()
    return
  }
  if (e.key === 'Delete' && canDelete.value) {
    e.preventDefault()
    onDelete()
  }
}

// Раньше обработчика мессенджера: Esc снимает выделение, а не закрывает чат.
onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
useCloseOnBack(
  () => props.selection.active,
  () => props.selection.clear()
)
</script>
