<template>
  <Modal
    :open="shareStore.isOpen"
    :width="440"
    :centered="true"
    :z-index="2700"
    :title="t('shareToChat.title')"
    :footer="null"
    @cancel="close"
  >
    <SC_ShareBody data-testid="share-to-chat">
      <SC_SharePreview v-if="shareStore.target" :title="shareStore.target.link">
        <LinkIcon />
        <span>{{ shareStore.target.title || shareStore.target.link }}</span>
      </SC_SharePreview>

      <SC_ShareSearch
        v-model="query"
        type="search"
        :placeholder="t('shareToChat.search')"
        :aria-label="t('shareToChat.search')"
        data-testid="share-to-chat-search"
      />

      <SC_ShareList role="listbox" :aria-label="t('shareToChat.chats')" aria-multiselectable="true">
        <SC_ShareRow
          v-for="dialog in targets"
          :key="dialog.id"
          role="option"
          :aria-selected="selected.has(dialog.id)"
          :class="{ on: selected.has(dialog.id) }"
          :disabled="blocked(dialog) || (!selected.has(dialog.id) && full)"
          :title="blocked(dialog) ? t('shareToChat.openChatSecret') : undefined"
          type="button"
          data-testid="share-to-chat-row"
          @click="toggle(dialog.id)"
        >
          <GroupAvatar
            v-if="dialog.group"
            :src="dialog.partner.avatar"
            :name="dialog.partner.name"
            :member-ids="dialog.group.previewIds"
            :size="40"
          />
          <Avatar
            v-else
            :src="dialog.partner.avatar"
            :alt="dialog.partner.name || dialog.partner.id"
            :fallback-text="dialog.partner.name || dialog.partner.id"
            :size="40"
            shape="circle"
          />
          <SC_ShareName data-testid="share-to-chat-name">
            {{ dialog.partner.name || dialog.partner.id }}
            <SC_ShareNote v-if="blocked(dialog)">{{ t('shareToChat.openChat') }}</SC_ShareNote>
          </SC_ShareName>
          <SC_ShareCheck :class="{ on: selected.has(dialog.id) }" aria-hidden="true">
            <CheckOutlined v-if="selected.has(dialog.id)" />
          </SC_ShareCheck>
        </SC_ShareRow>

        <SC_ShareEmpty v-if="!targets.length">
          {{ emptyText }}
        </SC_ShareEmpty>
      </SC_ShareList>

      <SC_ShareComment
        v-model="comment"
        rows="2"
        :placeholder="t('shareToChat.comment')"
        :aria-label="t('shareToChat.comment')"
        data-testid="share-to-chat-comment"
      />

      <SC_ShareHint v-if="full">{{ t('shareToChat.limit', { n: MAX_CHATS }) }}</SC_ShareHint>

      <SC_ShareFooter>
        <!-- Не в чат — ссылкой: как в меню «Поделиться» у Telegram. -->
        <SC_ShareExtra>
          <Button type="text" size="small" data-testid="share-to-chat-copy" @click="copyLink">
            <template #icon><CopyOutlined /></template>
            {{ t('shareToChat.copy') }}
          </Button>
          <Button v-if="canNativeShare" type="text" size="small" @click="nativeShare">
            <template #icon><ShareAltOutlined /></template>
            {{ t('postCard.shareVia') }}
          </Button>
        </SC_ShareExtra>
        <Button
          type="primary"
          :disabled="!selected.size"
          data-testid="share-to-chat-send"
          @click="send"
        >
          {{
            selected.size > 1
              ? t('shareToChat.sendMany', { n: selected.size })
              : t('shareToChat.send')
          }}
        </Button>
      </SC_ShareFooter>
    </SC_ShareBody>
  </Modal>
</template>

<script setup lang="ts">
// «Поделиться → Отправить в чат»: выбрать до MAX_CHATS чатов, добавить подпись,
// отправить. Каждому чату — одно сообщение: подпись и ссылка (lib/share-to-chat).
// Не в чат — «Скопировать ссылку» и системное «Поделиться через…».

import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckOutlined, CopyOutlined, LinkIcon, ShareAltOutlined } from '@/components/icons'
import { copyText } from '@/helpers/common/clipboard'
import Modal from '@/components/modal'
import Button from '@/components/button/button.vue'
import Avatar from '@/components/avatar/avatar.vue'
import { appToast } from '@/b-components/app-toast'
import { useCloseOnBack } from '@/composables/use-back-button'
import { useShareToChatStore } from '@/stores/share-to-chat-store'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import type { Dialog } from '../../types'
import { useMessengerStore } from '../../store'
import { useMessengerScreenStore } from '../../store/messenger-screen-store'
import { isOpenChat, shareMessageText, shareTargets } from '../../lib/share-to-chat'
import {
  SC_ShareBody,
  SC_ShareCheck,
  SC_ShareComment,
  SC_ShareEmpty,
  SC_ShareExtra,
  SC_ShareFooter,
  SC_ShareHint,
  SC_ShareList,
  SC_ShareName,
  SC_ShareNote,
  SC_SharePreview,
  SC_ShareRow,
  SC_ShareSearch,
} from './styled'

/** За раз — не больше: каждое сообщение уходит отдельно, а у сервера чатов есть предел частоты. */
const MAX_CHATS = 10

const { t } = useI18n()
const shareStore = useShareToChatStore()
const messenger = useMessengerStore()
const screen = useMessengerScreenStore()

const query = ref('')
const comment = ref('')
const selected = shallowRef<Set<string>>(new Set())

/** Все чаты, куда можно отправить, по порядку; поиск только сужает показ. */
const allTargets = computed(() => shareTargets(messenger.dialogs, '', screen.hiddenIds))
const targets = computed(() =>
  query.value.trim() ? shareTargets(allTargets.value, query.value) : allTargets.value
)
const full = computed<boolean>(() => selected.value.size >= MAX_CHATS)

/** Ссылка с ключом файла не уходит в чат без шифрования: ключ увидел бы сервер. */
function blocked(dialog: Dialog): boolean {
  return !!shareStore.target?.secret && isOpenChat(dialog)
}

const emptyText = computed<string>(() => {
  if (query.value.trim()) return t('shareToChat.notFound')
  if (messenger.isChatsLoading) return t('shareToChat.loading')
  if (messenger.syncError) return t('shareToChat.offline')
  return t('shareToChat.noChats')
})

// Каждое открытие — с чистого листа.
watch(
  () => shareStore.isOpen,
  (open) => {
    if (!open) return
    query.value = ''
    comment.value = ''
    selected.value = new Set()
  }
)

function toggle(id: string): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else if (next.size < MAX_CHATS) next.add(id)
  selected.value = next
}

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** Ссылка «как есть»: та же, что ушла бы в чат. */
async function copyLink(): Promise<void> {
  const link = shareStore.target?.link
  if (!link) return
  if (await copyText(link)) {
    appToast.success({ message: t('shareToChat.copied'), description: link })
    shareStore.close()
  } else {
    appToast.error({ message: t('postCard.shareFailed') })
  }
}

async function nativeShare(): Promise<void> {
  const target = shareStore.target
  if (!target) return
  try {
    await navigator.share({ url: target.link, text: target.title })
    shareStore.close()
  } catch (e) {
    // AbortError — закрыли системный диалог: остаёмся в окне.
    if (e instanceof Error && e.name !== 'AbortError') {
      appToast.error({ message: t('postCard.shareFailed') })
    }
  }
}

function close(): void {
  shareStore.close()
}

useCloseOnBack(
  computed(() => shareStore.isOpen),
  close
)

function send(): void {
  const target = shareStore.target
  if (!target) return
  const text = shareMessageText(target.link, comment.value)
  // В порядке списка — так, как их видно; поиск выбранное не отменяет.
  const chats = allTargets.value.filter((d) => selected.value.has(d.id) && !blocked(d))
  if (!chats.length) return
  // Окно закрывается сразу, как в Telegram: сообщение встаёт в чат, как
  // набранное в нём, и уходит, когда ответит сервер чатов (без связи — ждёт).
  // По одному: у сервера предел частоты. Не ушедшее — в чате с «Повторить».
  shareStore.close()
  void (async () => {
    for (const d of chats) await messenger.sendMessage(d.id, text).catch(() => {})
  })()
  if (chats.length === 1) {
    const id = chats[0]!.id
    appToast.success({
      message: t('shareToChat.sentTo', { name: chats[0]!.partner.name ?? '' }),
      description: t('shareToChat.open'),
      onClick: () => void messenger.openChat(id),
    })
  } else {
    appToast.success({ message: t('shareToChat.sentMany', { n: chats.length }, chats.length) })
  }
}
</script>
