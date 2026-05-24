<template>
  <SC_Dropdown @mousedown.prevent>
    <SC_LoadingHint v-if='isLoading && !hasAny'>
      Поиск…
    </SC_LoadingHint>

    <SC_EmptyHint v-else-if='!hasAny'>
      Ничего не найдено
    </SC_EmptyHint>

    <template v-else>
      <SC_DropdownSection v-if='users.length'>
        <SC_DropdownSectionHeader>
          Пользователи
          <SC_DropdownSeeAll @click='onSeeAll("users")'>Все →</SC_DropdownSeeAll>
        </SC_DropdownSectionHeader>
        <SC_DropdownItem
          v-for='u in users'
          :key='u.address'
          @click='onSelectUser(u)'
        >
          <SC_Avatar>
            <img v-if='u.i' :src='u.i' :alt='u.name || u.address' />
            <template v-else>{{ initialOf(u) }}</template>
          </SC_Avatar>
          <SC_ItemBody>
            <SC_ItemPrimary>{{ u.name || u.address }}</SC_ItemPrimary>
            <SC_ItemSecondary v-if='u.name'>{{ u.address }}</SC_ItemSecondary>
          </SC_ItemBody>
        </SC_DropdownItem>
      </SC_DropdownSection>

      <SC_DropdownSection v-if='tags.length'>
        <SC_DropdownSectionHeader>
          Теги
          <SC_DropdownSeeAll @click='onSeeAll("tags")'>Все →</SC_DropdownSeeAll>
        </SC_DropdownSectionHeader>
        <SC_DropdownItem
          v-for='t in tags'
          :key='t.tag'
          @click='onSelectTag(t)'
        >
          <SC_ItemBody>
            <SC_ItemPrimary>
              #{{ t.tag }}
              <SC_TagCount>{{ t.count }}</SC_TagCount>
            </SC_ItemPrimary>
          </SC_ItemBody>
        </SC_DropdownItem>
      </SC_DropdownSection>

      <SC_DropdownSection v-if='posts.length'>
        <SC_DropdownSectionHeader>
          Посты
          <SC_DropdownSeeAll @click='onSeeAll("posts")'>Все →</SC_DropdownSeeAll>
        </SC_DropdownSectionHeader>
        <SC_DropdownItem
          v-for='p in posts'
          :key='p.txid || p.hash'
          @click='onSelectPost(p)'
        >
          <SC_ItemBody>
            <SC_ItemPrimary>{{ postTitle(p) }}</SC_ItemPrimary>
            <SC_ItemSecondary v-if='p.m'>{{ truncate(p.m, 100) }}</SC_ItemSecondary>
          </SC_ItemBody>
        </SC_DropdownItem>
      </SC_DropdownSection>
    </template>
  </SC_Dropdown>
</template>

<script setup lang='ts'>
import { computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchUsers, useSearchPosts, useSearchTags } from '@/composables/use-search-query'
import { useSearchStore } from '@/stores/search-store'
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

const queryRef = toRef(props, 'query')

const usersQuery = useSearchUsers(queryRef, 5)
const tagsQuery = useSearchTags(queryRef, 5)
const postsQuery = useSearchPosts(queryRef, 5)

const users = computed<SearchUserResult[]>(() => usersQuery.data.value ?? [])
const tags = computed<SearchTag[]>(() => tagsQuery.data.value ?? [])
const posts = computed<SearchPost[]>(() => postsQuery.data.value ?? [])

const isLoading = computed(
  () => usersQuery.isFetching.value || tagsQuery.isFetching.value || postsQuery.isFetching.value
)

const hasAny = computed(() => users.value.length + tags.value.length + posts.value.length > 0)

function initialOf(u: SearchUserResult): string {
  const src = u.name || u.address
  return (src?.[0] ?? '?').toUpperCase()
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function postTitle(p: SearchPost): string {
  return p.c || p.m?.slice(0, 80) || p.txid || 'Пост'
}

function commitAndClose(): string {
  const value = searchStore.commit(props.query)
  emit('close')
  return value
}

function onSelectUser(u: SearchUserResult): void {
  commitAndClose()
  router.push({ name: 'profile', params: { userName: u.address } })
}

function onSelectTag(t: SearchTag): void {
  commitAndClose()
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
</script>
