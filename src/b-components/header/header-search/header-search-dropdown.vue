<template>
  <SC_Dropdown @mousedown.prevent>
    <!-- Recent: показывается, когда запрос короче порога (или пуст), но
         история не пуста. Это паритет со старым меню: dropdown сразу
         даёт что-то полезное, не только после первого ввода. -->
    <SC_DropdownSection v-if="showRecent">
      <SC_DropdownSectionHeader>
        {{ t('search.recent') }}
        <SC_RecentClearButton type="button" @click="onClearHistory">
          {{ t('search.clear') }}
        </SC_RecentClearButton>
      </SC_DropdownSectionHeader>
      <SC_DropdownItem
        v-for="entry in recentEntries"
        :key="entry.kind + ':' + entry.value"
        @click="onSelectRecent(entry)"
      >
        <SC_Avatar v-if="entry.kind === 'user' && entry.meta?.avatar">
          <img
            :src="entry.meta.avatar"
            :alt="entry.label || entry.value"
            loading="lazy"
            decoding="async"
          />
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
          :aria-label="t('search.removeFromHistory')"
          @click.stop="onRemoveRecent(entry)"
        >
          ×
        </SC_RecentRemoveButton>
      </SC_DropdownItem>
    </SC_DropdownSection>

    <template v-if="showResults">
      <SC_LoadingHint v-if="isLoading && !hasAny"> {{ t('search.searching') }} </SC_LoadingHint>

      <SC_EmptyHint v-else-if="!hasAny"> {{ t('search.noResults') }} </SC_EmptyHint>

      <template v-else>
        <SC_DropdownSection v-if="apps.length">
          <SC_DropdownSectionHeader> {{ t('search.apps') }} </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="a in apps" :key="a.id" @click="onSelectApp(a)">
            <SC_Avatar>
              <img v-if="a.icon" :src="a.icon" :alt="a.name" loading="lazy" decoding="async" />
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
            {{ t('search.tabUsers') }}
            <SC_DropdownSeeAll @click="onSeeAll('users')">{{ t('search.seeAll') }}</SC_DropdownSeeAll>
          </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="u in users" :key="u.address" @click="onSelectUser(u)">
            <SC_Avatar>
              <img
                v-if="u.i"
                :src="u.i"
                :alt="u.name || u.address"
                loading="lazy"
                decoding="async"
              />
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
            {{ t('search.tabTags') }}
            <SC_DropdownSeeAll @click="onSeeAll('tags')">{{ t('search.seeAll') }}</SC_DropdownSeeAll>
          </SC_DropdownSectionHeader>
          <SC_DropdownItem v-for="tag in tags" :key="tag.tag" @click="onSelectTag(tag)">
            <SC_ItemBody>
              <SC_ItemPrimary>
                #{{ tag.tag }}
                <SC_TagCount>{{ tag.count }}</SC_TagCount>
              </SC_ItemPrimary>
            </SC_ItemBody>
          </SC_DropdownItem>
        </SC_DropdownSection>

        <SC_DropdownSection v-if="posts.length">
          <SC_DropdownSectionHeader>
            {{ t('search.tabPosts') }}
            <SC_DropdownSeeAll @click="onSeeAll('posts')">{{ t('search.seeAll') }}</SC_DropdownSeeAll>
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
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MIN_QUERY_LENGTH } from '@/composables/use-search-query'
import { safeDecode } from '@/composables/use-feed'
import { useSearchResults } from './use-search-results'
import { useSearchRecent } from './use-search-recent'
import { useSearchNavigation } from './use-search-navigation'
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

const { t } = useI18n()
const router = useRouter()
const queryRef = toRef(props, 'query')

const showResults = computed(() => props.query.length >= MIN_QUERY_LENGTH)

const { users, tags, posts, apps, isLoading, hasAny } = useSearchResults(queryRef)

const emitClose = () => emit('close')
const {
  recentEntries,
  showRecent,
  iconForKind,
  secondaryFor,
  onSelectRecent,
  onRemoveRecent,
  onClearHistory,
} = useSearchRecent(router, showResults, emitClose)

const {
  onSelectUser,
  onSelectTag,
  onSelectPost,
  onSelectApp,
  onSeeAll,
  initialOf,
  initialOfApp,
  postTitle,
  truncate,
} = useSearchNavigation(router, queryRef, emitClose)
</script>
