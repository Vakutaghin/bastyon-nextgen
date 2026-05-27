<template>
  <SC_Dropdown @mousedown.prevent>
    <!-- Recent: показывается, когда запрос короче порога (или пуст), но
         история не пуста. Это паритет со старым меню: dropdown сразу
         даёт что-то полезное, не только после первого ввода. -->
    <SC_DropdownSection v-if="showRecent">
      <SC_DropdownSectionHeader>
        Недавнее
        <SC_RecentClearButton type="button" @click="onClearHistory">
          Очистить
        </SC_RecentClearButton>
      </SC_DropdownSectionHeader>
      <SC_DropdownItem
        v-for="entry in recentEntries"
        :key="entry.kind + ':' + entry.value"
        @click="onSelectRecent(entry)"
      >
        <SC_Avatar v-if="entry.kind === 'user' && entry.meta?.avatar">
          <img :src="entry.meta.avatar" :alt="entry.label || entry.value" />
        </SC_Avatar>
        <SC_RecentIcon v-else>
          {{ iconForKind(entry.kind) }}
        </SC_RecentIcon>
        <SC_ItemBody>
          <SC_ItemPrimary>{{ entry.label || entry.value }}</SC_ItemPrimary>
          <SC_ItemSecondary v-if="secondaryFor(entry)">
            {{ secondaryFor(entry) }}
          </SC_ItemSecondary>
        </SC_ItemBody>
        <SC_RecentRemoveButton
          type="button"
          aria-label="Убрать из истории"
          @click.stop="onRemoveRecent(entry)"
        >
          ×
        </SC_RecentRemoveButton>
      </SC_DropdownItem>
    </SC_DropdownSection>

    <template v-if="showResults">
      <SC_LoadingHint v-if="isLoading && !hasAny"> Поиск… </SC_LoadingHint>

      <SC_EmptyHint v-else-if="!hasAny"> Ничего не найдено </SC_EmptyHint>

      <template v-else>
        <SC_DropdownSection v-if="apps.length">
          <SC_DropdownSectionHeader> Приложения </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="a in apps" :key="a.id" @click="onSelectApp(a)">
            <SC_Avatar>
              <img v-if="a.icon" :src="a.icon" :alt="a.name" />
              <template v-else>{{ initialOfApp(a.name) }}</template>
            </SC_Avatar>
            <SC_ItemBody>
              <SC_ItemPrimary>{{ a.name }}</SC_ItemPrimary>
              <SC_ItemSecondary v-if="a.description">
                {{ truncate(a.description, 100) }}
              </SC_ItemSecondary>
            </SC_ItemBody>
          </SC_DropdownItem>
        </SC_DropdownSection>

        <SC_DropdownSection v-if="users.length">
          <SC_DropdownSectionHeader>
            Пользователи
            <SC_DropdownSeeAll @click="onSeeAll('users')">Все →</SC_DropdownSeeAll>
          </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="u in users" :key="u.address" @click="onSelectUser(u)">
            <SC_Avatar>
              <img v-if="u.i" :src="u.i" :alt="u.name || u.address" />
              <template v-else>{{ initialOf(u) }}</template>
            </SC_Avatar>
            <SC_ItemBody>
              <SC_ItemPrimary>{{ u.name || u.address }}</SC_ItemPrimary>
              <SC_ItemSecondary v-if="u.name">{{ u.address }}</SC_ItemSecondary>
            </SC_ItemBody>
          </SC_DropdownItem>
        </SC_DropdownSection>

        <SC_DropdownSection v-if="tags.length">
          <SC_DropdownSectionHeader>
            Теги
            <SC_DropdownSeeAll @click="onSeeAll('tags')">Все →</SC_DropdownSeeAll>
          </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="t in tags" :key="t.tag" @click="onSelectTag(t)">
            <SC_ItemBody>
              <SC_ItemPrimary>
                #{{ t.tag }}
                <SC_TagCount>{{ t.count }}</SC_TagCount>
              </SC_ItemPrimary>
            </SC_ItemBody>
          </SC_DropdownItem>
        </SC_DropdownSection>

        <SC_DropdownSection v-if="posts.length">
          <SC_DropdownSectionHeader>
            Посты
            <SC_DropdownSeeAll @click="onSeeAll('posts')">Все →</SC_DropdownSeeAll>
          </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="p in posts" :key="p.txid || p.hash" @click="onSelectPost(p)">
            <SC_ItemBody>
              <SC_ItemPrimary>{{ postTitle(p) }}</SC_ItemPrimary>
              <SC_ItemSecondary v-if="p.m">{{ truncate(safeDecode(p.m), 100) }}</SC_ItemSecondary>
            </SC_ItemBody>
          </SC_DropdownItem>
        </SC_DropdownSection>
      </template>
    </template>
  </SC_Dropdown>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import {
  useSearchUsers,
  useSearchTags,
  useSearchPosts,
  useSearchApps,
  MIN_QUERY_LENGTH,
} from '@/composables/use-search-query'
import { useSearchStore } from '@/stores/search-store'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { safeDecode } from '@/composables/use-feed'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import type { SearchHistoryEntry, SearchHistoryKind } from '@/stores/search-store-consts'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'
import {
  SC_Dropdown,
  SC_DropdownSection,
  SC_DropdownSectionHeader,
  SC_DropdownSeeAll,
  SC_DropdownItem,
  SC_Avatar,
  SC_ItemBody,
  SC_ItemPrimary,
  SC_ItemSecondary,
  SC_TagCount,
  SC_EmptyHint,
  SC_LoadingHint,
  SC_RecentClearButton,
  SC_RecentRemoveButton,
  SC_RecentIcon,
} from './styled'

const props = defineProps<{
  /** Debounced query — НЕ сырое значение из инпута. */
  query: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const searchStore = useSearchStore()
const appsStore = useAppsStore()

const queryRef = toRef(props, 'query')

const showResults = computed(() => props.query.length >= MIN_QUERY_LENGTH)

// Три раздельных RPC (users / tags / posts) + apps. Объединение в один
// вызов `search` с type='all' зафиксировано в SEARCH_TODO §9: формат
// ответа от ноды нужно проверить, иначе users/tags/posts оказываются
// пустыми, как только что произошло в проде.
const usersQuery = useSearchUsers(queryRef, 5)
const tagsQuery = useSearchTags(queryRef, 5)
const postsQuery = useSearchPosts(queryRef, 5)
const appsQuery = useSearchApps(queryRef, 4)

const users = computed<SearchUserResult[]>(() => usersQuery.data.value ?? [])
const tags = computed<SearchTag[]>(() => tagsQuery.data.value ?? [])
const posts = computed<SearchPost[]>(() => postsQuery.data.value ?? [])
const apps = computed<RemoteAppEntry[]>(() => appsQuery.data.value ?? [])

const isLoading = computed(
  () =>
    usersQuery.isFetching.value ||
    tagsQuery.isFetching.value ||
    postsQuery.isFetching.value ||
    appsQuery.isFetching.value
)

const hasAny = computed(
  () => users.value.length + tags.value.length + posts.value.length + apps.value.length > 0
)

const recentEntries = computed<SearchHistoryEntry[]>(() => searchStore.recentHistory)
const showRecent = computed(() => !showResults.value && recentEntries.value.length > 0)

function initialOf(u: SearchUserResult): string {
  const src = u.name || u.address
  return (src?.[0] ?? '?').toUpperCase()
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function postTitle(p: SearchPost): string {
  // Поля `c` и `m` приходят URL-encoded — без декода в UI получаются
  // кракозябры (см. safeDecode в use-feed.ts, используется в adaptPostData).
  const caption = safeDecode(p.c || '')
  if (caption) return caption
  const message = safeDecode(p.m || '')
  if (message) return message.slice(0, 80)
  return p.txid || 'Пост'
}

function commitAndClose(): string {
  const value = searchStore.commit(props.query)
  emit('close')
  return value
}

function onSelectUser(u: SearchUserResult): void {
  searchStore.commitUser(u.address, u.name, u.i)
  emit('close')
  router.push({ name: 'profile', params: { userName: u.address } })
}

function onSelectTag(t: SearchTag): void {
  searchStore.commitTag(t.tag)
  emit('close')
  router.push({ path: '/search', query: { q: `#${t.tag}`, type: 'posts' } })
}

function onSelectPost(p: SearchPost): void {
  const value = commitAndClose()
  router.push({ path: '/search', query: { q: value, type: 'posts', focus: p.txid || p.hash } })
}

function onSeeAll(type: 'users' | 'tags' | 'posts'): void {
  const value = commitAndClose()
  if (!value) return
  router.push({ path: '/search', query: { q: value, type } })
}

function initialOfApp(name: string): string {
  return (name?.[0] ?? '?').toUpperCase()
}

function onSelectApp(entry: RemoteAppEntry): void {
  // Открываем mini-app по той же схеме, что и mini-apps-grid:
  // если приложение ещё не установлено — регистрируем его в локальном
  // сторе, затем переходим на /app/<id>.
  appsStore.installFromRemoteEntry(entry)
  searchStore.commitApp(entry.id, entry.name, entry.icon)
  emit('close')
  router.push(`/app/${encodeURIComponent(entry.id)}`)
}

function iconForKind(kind: SearchHistoryKind): string {
  switch (kind) {
    case 'query':
      return '⌕'
    case 'tag':
      return '#'
    case 'user':
      return '@'
    case 'app':
      return '▦'
  }
}

function secondaryFor(entry: SearchHistoryEntry): string | undefined {
  if (entry.kind === 'user' && entry.meta?.name && entry.meta.name !== entry.label) {
    return entry.value
  }
  return undefined
}

function onSelectRecent(entry: SearchHistoryEntry): void {
  emit('close')
  switch (entry.kind) {
    case 'query':
      searchStore.setQuery(entry.value)
      searchStore.commit(entry.value)
      router.push({ path: '/search', query: { q: entry.value } })
      return
    case 'tag':
      searchStore.commitTag(entry.value)
      router.push({ path: '/search', query: { q: `#${entry.value}`, type: 'posts' } })
      return
    case 'user':
      searchStore.commitUser(entry.value, entry.meta?.name, entry.meta?.avatar)
      router.push({ name: 'profile', params: { userName: entry.value } })
      return
    case 'app':
      // Запись в истории создаётся только когда приложение уже было
      // открыто из dropdown — значит оно зарегистрировано в appsStore через
      // installFromRemoteEntry и доступно по /app/<id>.
      router.push(`/app/${encodeURIComponent(entry.value)}`)
      return
  }
}

function onRemoveRecent(entry: SearchHistoryEntry): void {
  searchStore.removeFromHistory(entry)
}

function onClearHistory(): void {
  searchStore.clearHistory()
}
</script>
