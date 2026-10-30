<template>
  <SC_ChatListRoot>
    <!-- Что показывать: «Все» или личные, группы и каналы в любом сочетании, как флажки.
         Выбор помнится и общий у окошка и полноэкранного мессенджера. -->
    <SC_SearchBar v-if="searchOpen" role="search">
      <SearchOutlined aria-hidden="true" />
      <SC_SearchInput
        ref="searchInputRef"
        v-model="searchQuery"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        data-testid="chat-search-input"
        :placeholder="t('messenger.listSearch.placeholder')"
        :aria-label="t('messenger.listSearch.placeholder')"
        @keydown.esc.stop.prevent="closeSearch"
        @keydown.enter.prevent="pickFirst"
      />
      <SC_ChatsLoadingSpinner
        v-if="peopleLoading"
        data-testid="chat-search-loading"
        :aria-label="t('messenger.listSearch.searching')"
      />
      <SC_SearchClose
        type="button"
        data-testid="chat-search-close"
        :aria-label="t('messenger.listSearch.close')"
        :title="t('messenger.listSearch.close')"
        @click="closeSearch"
      >
        <CloseOutlined />
      </SC_SearchClose>
    </SC_SearchBar>
    <SC_ChatFilter v-else role="group" :aria-label="t('messenger.filterLabel')">
      <SC_FilterChip
        type="button"
        :aria-pressed="showAll"
        :class="{ active: showAll }"
        data-filter="all"
        @click="store.setChatFilter([])"
      >
        {{ t('messenger.filterAll') }}
      </SC_FilterChip>
      <SC_FilterChip
        v-for="f in KIND_CHIPS"
        :key="f.id"
        type="button"
        :aria-pressed="isOn(f.id)"
        :class="{ active: isOn(f.id), channels: f.id === 'channels' }"
        :data-filter="f.id"
        @click="store.toggleChatKind(f.id)"
      >
        <MegaphoneIcon v-if="f.id === 'channels'" />
        <TeamOutlined v-else-if="f.id === 'groups'" />
        {{ t(f.label) }}
        <!-- Новое в невыбранном разделе видно, не переключаясь. -->
        <SC_ChipCount
          v-if="!showAll && !isOn(f.id) && hiddenNew[f.id]"
          :aria-label="t('messenger.filterHasNew', { n: hiddenNew[f.id] })"
        >
          {{ hiddenNew[f.id] }}
        </SC_ChipCount>
      </SC_FilterChip>
    </SC_ChatFilter>
    <SC_ChatList v-if="isSearching" data-testid="chat-search-results">
      <SC_SearchSection>{{ t('messenger.listSearch.chats') }}</SC_SearchSection>
      <template v-for="row in foundChats" :key="row.id">
        <ChannelListItem v-if="row.channel" :address="row.channel" @click="pickChat(row.id)" />
        <ChatListItem v-else-if="row.dialog" :dialog="row.dialog" @click="pickChat(row.id)" />
      </template>
      <SC_SearchNote v-if="foundChats.length === 0">{{
        t('messenger.listSearch.noChats')
      }}</SC_SearchNote>

      <SC_SearchSection>{{ t('messenger.listSearch.people') }}</SC_SearchSection>
      <SC_SearchNote v-if="tooShort">{{ t('messenger.listSearch.typeMore') }}</SC_SearchNote>
      <template v-else>
        <SC_PersonRow
          v-for="u in people"
          :key="u.address"
          type="button"
          data-testid="chat-search-person"
          @click="pickPerson(u)"
        >
          <Avatar
            :src="personAvatar(u)"
            :alt="personName(u)"
            :fallback-text="personName(u)"
            :size="40"
            :mark="userMark(u, u.address)"
            shape="circle"
          />
          <SC_PersonInfo>
            <SC_PersonName>{{ personName(u) }}</SC_PersonName>
            <SC_PersonAddress>{{ shortAddress(u.address) }}</SC_PersonAddress>
          </SC_PersonInfo>
        </SC_PersonRow>
        <SC_ChatsLoading v-if="peopleLoading && people.length === 0">
          <SC_ChatsLoadingSpinner aria-hidden="true" />
          {{ t('messenger.listSearch.searching') }}
        </SC_ChatsLoading>
        <SC_SearchNote v-else-if="peopleFailed">{{
          t('messenger.listSearch.failed')
        }}</SC_SearchNote>
        <SC_SearchNote v-else-if="peopleDone && people.length === 0">
          {{ t('messenger.listSearch.noPeople') }}
        </SC_SearchNote>
      </template>
    </SC_ChatList>
    <SC_ChatList v-else>
      <SC_ChatsLoading v-if="chatsLoading" data-testid="chats-loading">
        <SC_ChatsLoadingSpinner aria-hidden="true" />
        {{ t('messenger.loadingDialogs') }}
      </SC_ChatsLoading>
      <template v-for="row in shown" :key="row.id">
        <ChannelListItem v-if="row.channel" :address="row.channel" @click="onSelect(row.id)" />
        <ChatListItem v-else-if="row.dialog" :dialog="row.dialog" @click="onSelect(row.id)" />
      </template>

      <SC_EmptyHint v-if="shown.length === 0 && isOn('channels')" data-testid="channels-empty">
        <MegaphoneIcon />
        <strong>{{ t('messenger.channel.emptyTitle') }}</strong>
        <span>{{ t('messenger.channel.emptyText') }}</span>
      </SC_EmptyHint>
      <SC_EmptyHint v-else-if="shown.length === 0 && emptyText && !chatsLoading">
        <span>{{ t(emptyText) }}</span>
      </SC_EmptyHint>
      <!-- Пустой список без подписи выглядел как сбой. Ошибку синка показывает свой баннер. -->
      <SC_EmptyHint
        v-else-if="shown.length === 0 && !chatsLoading && !store.syncError"
        data-testid="chats-empty"
      >
        <MessageOutlined />
        <strong>{{ t('messenger.chatsEmptyTitle') }}</strong>
        <span>{{ t('messenger.chatsEmptyText') }}</span>
      </SC_EmptyHint>
    </SC_ChatList>
  </SC_ChatListRoot>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CloseOutlined,
  MegaphoneIcon,
  MessageOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import { useAuthStore } from '@/blockchain'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { safeDecode } from '@/helpers/content/safe-decode'
import { userMark } from '@/helpers/profile/user-mark'
import { shortAddress } from '@/services/user-names'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { isGroupDialog, type Dialog } from '../../types'
import { useMessengerStore } from '../../store'
import { useMessengerChannelsStore } from '../../store/messenger-channels-store'
import { channelChatId } from '../../lib/channels'
import { getAddressFromMatrixId } from '../../helpers'
import type { ChatKind } from '../../store/messenger-ui-store'
import ChatListItem from '../chat-list-item/chat-list-item.vue'
import ChannelListItem from '../channel-list-item/channel-list-item.vue'
import { useChatSearch, type SearchCandidate } from './use-chat-search'
import { chatSearchOpen } from './chat-search-state'
import {
  SC_ChatFilter,
  SC_ChatList,
  SC_ChatListRoot,
  SC_ChatsLoading,
  SC_ChatsLoadingSpinner,
  SC_ChipCount,
  SC_EmptyHint,
  SC_FilterChip,
  SC_PersonAddress,
  SC_PersonInfo,
  SC_PersonName,
  SC_PersonRow,
  SC_SearchBar,
  SC_SearchClose,
  SC_SearchInput,
  SC_SearchNote,
  SC_SearchSection,
} from './styled'

const KIND_CHIPS: Array<{ id: ChatKind; label: string }> = [
  { id: 'direct', label: 'messenger.filterDirect' },
  { id: 'groups', label: 'messenger.filterGroups' },
  { id: 'channels', label: 'messenger.filterChannels' },
]

/** Пока список на экране, строки каналов обновляются раз в несколько минут. */
const CHANNELS_REFRESH_EVERY = 3 * 60_000

const props = defineProps<{ dialogs: Dialog[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const store = useMessengerStore()
const channels = useMessengerChannelsStore()

const showAll = computed<boolean>(() => store.chatFilter.length === 0)
const isOn = (kind: ChatKind): boolean => store.chatFilter.includes(kind)
/** Переписки ещё грузятся, а каналы уже видны: каналам строка не нужна. */
const chatsLoading = computed<boolean>(
  () => store.isChatsLoading && (showAll.value || isOn('direct') || isOn('groups'))
)

interface Row {
  id: string
  time: number
  dialog?: Dialog
  /** Адрес автора канала. */
  channel?: string
}

const dialogRows = computed<Row[]>(() =>
  props.dialogs
    .filter((d) => showAll.value || isOn(isGroupDialog(d) ? 'groups' : 'direct'))
    .map((d) => ({
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

/** Чаты уже по порядку — каналы вставляются между ними по времени. */
function mergeByTime(dialogs: Row[], channelList: Row[]): Row[] {
  const out: Row[] = []
  let i = 0
  for (const d of dialogs) {
    while (i < channelList.length && channelList[i]!.time > d.time) {
      out.push(channelList[i++]!)
    }
    out.push(d)
  }
  return out.concat(channelList.slice(i))
}

const shown = computed<Row[]>(() => {
  if (!showAll.value && !isOn('channels')) return dialogRows.value
  if (!showAll.value && !isOn('direct') && !isOn('groups')) return channelRows.value
  return mergeByTime(dialogRows.value, channelRows.value)
})

// Поиск идёт по всем чатам, какой бы раздел ни был выбран.
const searchCandidates = computed<SearchCandidate<Row>[]>(() =>
  mergeByTime(
    props.dialogs.map((d) => ({
      id: d.id,
      time: d.lastMessage?.timestamp ?? d.createdAt ?? 0,
      dialog: d,
    })),
    channelRows.value
  ).map((row) => ({
    item: row,
    name: row.dialog?.partner.name ?? store.userProfiles[row.channel ?? '']?.name ?? '',
  }))
)

const auth = useAuthStore()
const {
  isOpen: searchOpen,
  query: searchQuery,
  isSearching,
  chats: foundChats,
  tooShort,
  people,
  peopleLoading,
  peopleDone,
  peopleFailed,
  close: closeSearch,
} = useChatSearch(searchCandidates, () => auth.address, chatSearchOpen)

const searchInputRef = ref<{ $el?: HTMLInputElement } | HTMLInputElement | null>(null)

// Лупа в шапке открыла поле — сразу в него ввод.
watch(
  searchOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    const el = searchInputRef.value
    ;(el && '$el' in el ? el.$el : (el as HTMLInputElement | null))?.focus()
  },
  { immediate: true }
)

function personName(u: SearchUserResult): string {
  return safeDecode(u.name) || shortAddress(u.address)
}

function personAvatar(u: SearchUserResult): string | undefined {
  return resolveImageUrl(typeof u.i === 'string' ? u.i : undefined)
}

function pickChat(id: string): void {
  closeSearch()
  onSelect(id)
}

/** Человек из сети: есть переписка — откроется она, нет — новый чат с ним. */
function pickPerson(u: SearchUserResult): void {
  closeSearch()
  void store.openInviteWithAddress(u.address, u as UserProfile)
}

/** Enter — первый найденный: сначала свои чаты, потом люди. */
function pickFirst(): void {
  const chat = foundChats.value[0]
  if (chat) return pickChat(chat.id)
  const person = people.value[0]
  if (person) pickPerson(person)
}

/** Пустой список без каналов: чего именно нет. С каналами — подсказка, как их завести. */
const emptyText = computed<string | null>(() => {
  if (showAll.value) return null
  if (isOn('direct') && isOn('groups')) return 'messenger.filterChatsEmpty'
  if (isOn('direct')) return 'messenger.filterDirectEmpty'
  return 'messenger.filterGroupsEmpty'
})

/** Где есть новое: переписки с непрочитанным и каналы с новыми постами. */
const hiddenNew = computed<Record<ChatKind, number>>(() => {
  const unread = props.dialogs.filter((d) => d.unreadCount > 0 || d.hasUnread)
  const groups = unread.filter(isGroupDialog).length
  return { direct: unread.length - groups, groups, channels: channels.withNew }
})

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
  // Открыли чат или закрыли окно — к списку вернутся без поиска.
  closeSearch()
})

function onSelect(id: string): void {
  emit('select', id)
}
</script>
