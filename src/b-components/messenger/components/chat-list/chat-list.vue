<template>
  <SC_ChatListRoot>
    <!-- Что показывать: всё, переписки или каналы. Выбор помнится и общий у окошка и полноэкранного мессенджера. -->
    <SC_ChatFilter role="radiogroup" :aria-label="t('messenger.filterLabel')">
      <SC_FilterChip
        v-for="f in FILTERS"
        :key="f.id"
        type="button"
        role="radio"
        :aria-checked="filter === f.id"
        :class="{ active: filter === f.id, channels: f.id === 'channels' }"
        :data-filter="f.id"
        @click="store.setChatFilter(f.id)"
      >
        <MegaphoneIcon v-if="f.id === 'channels'" />
        {{ t(f.label) }}
        <!-- Новое в другом разделе видно, не переключаясь. -->
        <SC_ChipCount
          v-if="filter !== f.id && filter !== 'all' && hiddenNew[f.id]"
          :aria-label="t('messenger.filterHasNew', { n: hiddenNew[f.id] })"
        >
          {{ hiddenNew[f.id] }}
        </SC_ChipCount>
      </SC_FilterChip>
    </SC_ChatFilter>
    <SC_ChatList>
      <SC_ChatsLoading v-if="chatsLoading" data-testid="chats-loading">
        <SC_ChatsLoadingSpinner aria-hidden="true" />
        {{ t('messenger.loadingDialogs') }}
      </SC_ChatsLoading>
      <template v-for="row in shown" :key="row.id">
        <ChannelListItem v-if="row.channel" :address="row.channel" @click="onSelect(row.id)" />
        <ChatListItem v-else-if="row.dialog" :dialog="row.dialog" @click="onSelect(row.id)" />
      </template>

      <SC_EmptyHint v-if="shown.length === 0 && filter === 'channels'" data-testid="channels-empty">
        <MegaphoneIcon />
        <strong>{{ t('messenger.channel.emptyTitle') }}</strong>
        <span>{{ t('messenger.channel.emptyText') }}</span>
      </SC_EmptyHint>
      <SC_EmptyHint v-else-if="shown.length === 0 && filter === 'chats' && !chatsLoading">
        <span>{{ t('messenger.filterChatsEmpty') }}</span>
      </SC_EmptyHint>
    </SC_ChatList>
  </SC_ChatListRoot>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MegaphoneIcon } from '@/components/icons'
import type { Dialog } from '../../types'
import { useMessengerStore } from '../../store'
import { useMessengerChannelsStore } from '../../store/messenger-channels-store'
import { channelChatId } from '../../lib/channels'
import { getAddressFromMatrixId } from '../../helpers'
import type { ChatFilter } from '../../store/messenger-ui-store'
import ChatListItem from '../chat-list-item/chat-list-item.vue'
import ChannelListItem from '../channel-list-item/channel-list-item.vue'
import {
  SC_ChatFilter,
  SC_ChatList,
  SC_ChatListRoot,
  SC_ChatsLoading,
  SC_ChatsLoadingSpinner,
  SC_ChipCount,
  SC_EmptyHint,
  SC_FilterChip,
} from './styled'

const FILTERS: Array<{ id: ChatFilter; label: string }> = [
  { id: 'all', label: 'messenger.filterAll' },
  { id: 'chats', label: 'messenger.filterChats' },
  { id: 'channels', label: 'messenger.filterChannels' },
]

/** Пока список на экране, строки каналов обновляются раз в несколько минут. */
const CHANNELS_REFRESH_EVERY = 3 * 60_000

const props = defineProps<{ dialogs: Dialog[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const store = useMessengerStore()
const channels = useMessengerChannelsStore()

const filter = computed<ChatFilter>(() => store.chatFilter)
/** Переписки ещё грузятся, а каналы уже видны: каналам строка не нужна. */
const chatsLoading = computed<boolean>(() => store.isChatsLoading && filter.value !== 'channels')

interface Row {
  id: string
  time: number
  dialog?: Dialog
  /** Адрес автора канала. */
  channel?: string
}

const dialogRows = computed<Row[]>(() =>
  props.dialogs.map((d) => ({
    id: d.id,
    time: d.lastMessage?.timestamp ?? d.createdAt ?? 0,
    dialog: d,
  }))
)

/** Каналы по свежести последнего поста; ещё не загруженный — по времени добавления. */
const channelRows = computed<Row[]>(() =>
  channels.addresses
    .map((address) => ({
      id: channelChatId(address),
      time: channels.summaries[address]?.last?.time ?? channels.doc.items[address]?.t ?? 0,
      channel: address,
    }))
    .sort((a, b) => b.time - a.time)
)

const shown = computed<Row[]>(() => {
  if (filter.value === 'chats') return dialogRows.value
  if (filter.value === 'channels') return channelRows.value
  // Чаты уже по порядку — каналы вставляются между ними по времени.
  const out: Row[] = []
  let i = 0
  for (const d of dialogRows.value) {
    while (i < channelRows.value.length && channelRows.value[i]!.time > d.time) {
      out.push(channelRows.value[i++]!)
    }
    out.push(d)
  }
  return out.concat(channelRows.value.slice(i))
})

/** Где есть новое: переписки с непрочитанным и каналы с новыми постами. */
const hiddenNew = computed<Record<ChatFilter, number>>(() => ({
  all: 0,
  chats: props.dialogs.filter((d) => d.unreadCount > 0 || d.hasUnread).length,
  channels: channels.withNew,
}))

// Имена в мозаике группы и в «Анна: …» — из профилей Bastyon. Список с
// прошлого запуска приходит раньше синка, и без запроса там стояли адреса.
// Авторы каналов — оттуда же.
watch(
  () => [props.dialogs, channels.addresses] as const,
  ([list, channelAddresses]) => {
    const missing = new Set<string>()
    for (const d of list) {
      if (!d.group) continue
      const ids = d.lastMessage
        ? [...d.group.previewIds, d.lastMessage.senderId]
        : d.group.previewIds
      for (const id of ids) {
        const address = getAddressFromMatrixId(id)
        if (address && !store.userProfiles[address]) missing.add(address)
      }
    }
    for (const address of channelAddresses) {
      if (!store.userProfiles[address]) missing.add(address)
    }
    if (missing.size) void store.fetchProfiles([...missing])
  },
  { immediate: true }
)

// Строки каналов — с ноды, пока список на экране: свёрнутое окошко на
// компьютере остаётся в странице, но опрашивать ноду ему незачем.
const listShown = computed<boolean>(() => store.isOpen || store.isFullScreen)
watch(listShown, (shown) => {
  if (shown) void channels.refresh()
})

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  if (listShown.value) void channels.refresh()
  refreshTimer = setInterval(() => {
    if (listShown.value && !document.hidden) void channels.refresh()
  }, CHANNELS_REFRESH_EVERY)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

function onSelect(id: string): void {
  emit('select', id)
}
</script>
