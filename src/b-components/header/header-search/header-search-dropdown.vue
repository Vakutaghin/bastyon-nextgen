<template>
  <SC_Dropdown @mousedown.prevent>
    <!-- Эксплорер: если запрос похож на высоту/хеш/адрес — сразу предлагаем
         открыть его в блок-эксплорере, не дожидаясь поисковых RPC. Для 64-hex
         (block-hash ИЛИ txid различить локально нельзя) показываем оба пункта. -->
    <SC_DropdownSection v-if="explorerSuggestions.length">
      <SC_DropdownSectionHeader>{{ t('search.explorerSection') }}</SC_DropdownSectionHeader>
      <SC_DropdownItem
        v-for="s in explorerSuggestions"
        :key="s.kind + ':' + s.value"
        @click="onSelectExplorer(s)"
      >
        <SC_RecentIcon>{{ s.icon }}</SC_RecentIcon>
        <SC_ItemBody>
          <SC_ItemPrimary>{{ s.label }}</SC_ItemPrimary>
          <SC_ItemSecondary>{{ s.display }}</SC_ItemSecondary>
        </SC_ItemBody>
      </SC_DropdownItem>
    </SC_DropdownSection>

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

      <SC_EmptyHint v-else-if="!hasAny && !explorerSuggestions.length">
        {{ t('search.noResults') }}
      </SC_EmptyHint>

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
            <SC_DropdownSeeAll @click="onSeeAll('users')">{{
              t('search.seeAll')
            }}</SC_DropdownSeeAll>
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
            <SC_DropdownSeeAll @click="onSeeAll('tags')">{{
              t('search.seeAll')
            }}</SC_DropdownSeeAll>
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
            <SC_DropdownSeeAll @click="onSeeAll('posts')">{{
              t('search.seeAll')
            }}</SC_DropdownSeeAll>
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
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { MIN_QUERY_LENGTH } from '@/composables/use-search-query'
import { safeDecode } from '@/composables/use-feed'
import {
  explorerRouteSuggestions,
  type ExplorerEntityKind,
} from '@/pages/block-explorer-page/components/explorer-search/use-explorer-search'
import { recordVisit } from '@/pages/block-explorer-page/components/shared/use-search-history'
import { shortenHash } from '@/pages/block-explorer-page/components/shared/format-explorer'
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

interface ExplorerSuggestion {
  kind: ExplorerEntityKind
  icon: string
  label: string
  value: string
  display: string
  to: RouteLocationRaw
}

const EXPLORER_META: Record<ExplorerEntityKind, { icon: string; labelKey: string }> = {
  block: { icon: '🧊', labelKey: 'search.explorerOpenBlock' },
  tx: { icon: '🔗', labelKey: 'search.explorerOpenTx' },
  address: { icon: '📍', labelKey: 'search.explorerOpenAddress' },
}

// Локальная классификация запроса (без сети). Маршруты считает
// explorerRouteSuggestions; здесь только presentation — иконка/лейбл/превью.
const explorerSuggestions = computed<ExplorerSuggestion[]>(() =>
  explorerRouteSuggestions(props.query).map((s) => {
    const meta = EXPLORER_META[s.kind]
    return {
      kind: s.kind,
      icon: meta.icon,
      label: t(meta.labelKey),
      value: s.value,
      display:
        s.kind === 'block' && /^\d+$/.test(s.value) ? `#${s.value}` : shortenHash(s.value, 10, 8),
      to: { name: s.routeName, params: { [s.paramKey]: s.value } },
    }
  })
)

function onSelectExplorer(s: ExplorerSuggestion): void {
  recordVisit(s.value, s.kind)
  emit('close')
  router.push(s.to)
}

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
