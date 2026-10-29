<template>
  <SC_TopWork>
    <SC_TopPage>
      <SC_TopTitle>{{ t('topAccounts.title') }}</SC_TopTitle>
      <SC_TopNote>{{ t('topAccounts.note', { n: TOP_SIZE }) }}</SC_TopNote>

      <SC_TopStatus v-if="store.status === 'error'" role="alert">
        {{ t('topAccounts.failed') }}
        <Button @click="store.load(true)">{{ t('topAccounts.retry') }}</Button>
      </SC_TopStatus>

      <template v-else-if="store.status !== 'ready'">
        <SC_TopStatus role="status">{{ t('topAccounts.loading') }}</SC_TopStatus>
        <SC_TopList aria-hidden="true">
          <SC_TopItem v-for="i in 8" :key="i">
            <SC_TopRowStatic>
              <SC_Rank>{{ i }}</SC_Rank>
              <Skeleton :width="40" :height="40" radius="50%" />
              <SC_Who>
                <Skeleton :width="140" :height="14" />
                <Skeleton :width="200" :height="10" />
              </SC_Who>
              <SC_Metric><Skeleton :width="70" :height="14" /></SC_Metric>
            </SC_TopRowStatic>
          </SC_TopItem>
        </SC_TopList>
      </template>

      <template v-else>
        <SC_TopFilter>
          <Input
            v-model:value="query"
            allow-clear
            :placeholder="t('topAccounts.filter')"
            :aria-label="t('topAccounts.filter')"
          >
            <template #prefix><SearchOutlined /></template>
          </Input>
          <SC_FilterHint v-if="filtering && namesPending" role="status">
            {{ t('topAccounts.filterLoadingNames') }}
          </SC_FilterHint>
        </SC_TopFilter>

        <SC_TopStatus v-if="filtering && found.length === 0" role="status">
          {{ namesPending ? t('topAccounts.filterLoadingNames') : t('topAccounts.filterEmpty') }}
        </SC_TopStatus>

        <SC_TopList v-else data-testid="top-accounts">
          <SC_TopItem
            v-for="{ entry, rank } in shown"
            :key="entry.address"
            :class="{ me: entry.address === myAddress }"
          >
            <router-link v-slot="{ href, navigate }" :to="profilePath(entry.address)" custom>
              <SC_TopRow :href="href" @click="navigate">
                <SC_Rank :class="{ podium: rank <= 3 }">{{ rank }}</SC_Rank>
                <Avatar
                  :src="avatarOf(entry.address)"
                  :alt="nameOf(entry.address)"
                  :fallback-text="nameOf(entry.address)"
                  :size="40"
                  :mark="userMarkOf(entry.address, store.profiles[entry.address])"
                />
                <SC_Who>
                  <SC_Name>
                    <Skeleton v-if="!store.profiles[entry.address]" :width="140" :height="14" />
                    <span v-else class="name-text">{{ nameOf(entry.address) }}</span>
                    <SC_You v-if="entry.address === myAddress">{{ t('topAccounts.you') }}</SC_You>
                  </SC_Name>
                  <SC_Meta>{{ metaOf(entry.address) }}</SC_Meta>
                </SC_Who>
                <SC_Metric>
                  <span class="metric-value">{{ formatTopReputation(entry.reputation) }}</span>
                  <span class="metric-label">{{ t('topAccounts.reputation') }}</span>
                </SC_Metric>
              </SC_TopRow>
            </router-link>

            <!-- Подписка — рядом со ссылкой на профиль, а не в ней: кнопка в
                 ссылке и открывала бы профиль. -->
            <SC_FollowCell v-if="canFollow(entry.address)">
              <SC_FollowButton
                v-if="relations.isBlocked(entry.address)"
                type="button"
                class="subscribed"
                :disabled="relations.isPending(entry.address)"
                :aria-label="t('comments.unblock')"
                :title="t('comments.unblock')"
                @click="confirmUnblock(entry.address)"
              >
                <LoadingOutlined v-if="relations.isPending(entry.address)" spin />
                <span class="label">{{ t('comments.unblock') }}</span>
              </SC_FollowButton>
              <SC_FollowButton
                v-else
                type="button"
                :class="{
                  subscribed:
                    relations.isSubscribed(entry.address) ||
                    !relations.isSubscriptionKnown(entry.address),
                }"
                :disabled="followBusy(entry.address)"
                :aria-label="followLabel(entry.address)"
                :title="followLabel(entry.address)"
                data-testid="top-follow"
                @click="toggleFollow(entry.address)"
              >
                <LoadingOutlined v-if="followBusy(entry.address)" spin />
                <CheckOutlined v-else-if="relations.isSubscribed(entry.address)" />
                <PlusOutlined v-else />
                <span class="label">{{ followLabel(entry.address) }}</span>
              </SC_FollowButton>
            </SC_FollowCell>
          </SC_TopItem>
          <SC_Sentinel v-if="shown.length < found.length" ref="sentinelRef" aria-hidden="true" />
        </SC_TopList>
      </template>
    </SC_TopPage>
  </SC_TopWork>
</template>

<script setup lang="ts">
// Топ аккаунтов по репутации. Список собирается один раз (см.
// services/top-accounts), а строки показываются по 30 — следующие, когда
// долистали до конца; профили догружаются только у показанных. Начали искать
// по списку — догружаются профили всех: искать надо и по именам дальних строк.
// В строке — подписка, как в списке подписчиков профиля.

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input } from 'ant-design-vue'
import { CheckOutlined, LoadingOutlined, PlusOutlined, SearchOutlined } from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import { useAuthStore } from '@/blockchain'
import { useUserRelationsStore } from '@/stores'
import { useRelationActions } from '@/composables/use-relation-actions'
import { useTopAccountsStore } from '@/stores/top-accounts-store'
import { TOP_SIZE } from '@/services/top-accounts'
import { userMarkOf } from '@/services/user-marks'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import { formatTopCount, formatTopReputation, registrationYear } from './top-format'
import { filterTop, normalizeTopQuery } from './top-filter'
import {
  SC_FilterHint,
  SC_FollowButton,
  SC_FollowCell,
  SC_Meta,
  SC_Metric,
  SC_Name,
  SC_Rank,
  SC_Sentinel,
  SC_TopFilter,
  SC_TopItem,
  SC_TopList,
  SC_TopNote,
  SC_TopPage,
  SC_TopRow,
  SC_TopRowStatic,
  SC_TopStatus,
  SC_TopTitle,
  SC_TopWork,
  SC_Who,
  SC_You,
} from './top-accounts-page.styled'

/** Сколько строк добавлять за раз. */
const PAGE = 30

const { t } = useI18n()
const store = useTopAccountsStore()
const authStore = useAuthStore()
const myAddress = computed(() => authStore.getUserAddress ?? '')

const relations = useUserRelationsStore()
// Подписка сразу, отписка — с вопросом; разблокировка — с вопросом.
const { toggleFollow, confirmUnblock } = useRelationActions()

const query = ref('')
const filtering = computed(() => normalizeTopQuery(query.value) !== '')
const found = computed(() =>
  filterTop(store.entries, (address) => store.profiles[address]?.name, query.value)
)
/** Ищем, а имена всех ещё грузятся: найденное может прибавиться. */
const namesLoading = ref(false)
const namesPending = computed(() => filtering.value && namesLoading.value)

const limit = ref(PAGE)
const shown = computed(() => found.value.slice(0, limit.value))

void store.load()

// Новый запрос — снова с начала списка. Первый поиск по этому топу просит
// профили всех, один раз: без профиля бывает адрес, который нода не знает, и
// спрашивать его на каждую букву незачем. «Грузятся» — до ответа.
let namesAskedFor: readonly unknown[] | null = null
watch(query, () => {
  limit.value = PAGE
  if (!filtering.value || namesAskedFor === store.entries) return
  namesAskedFor = store.entries
  namesLoading.value = true
  void store
    .ensureProfiles(store.entries.map((e) => e.address))
    .finally(() => (namesLoading.value = false))
})

// Показанным строкам — профили.
watch(
  () => shown.value.map((r) => r.entry.address).join(','),
  () => void store.ensureProfiles(shown.value.map((r) => r.entry.address)),
  { immediate: true }
)

// --- Подгрузка при прокрутке ---
const sentinelRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

watch(sentinelRef, (raw) => {
  observer?.disconnect()
  const el = raw instanceof HTMLElement ? raw : (raw?.$el ?? null)
  if (!el) return
  observer = new IntersectionObserver(
    (records) => {
      if (records.some((r) => r.isIntersecting)) limit.value += PAGE
    },
    { rootMargin: '600px 0px' }
  )
  observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())

// --- Строка ---
/** Подписаться можно на всех, кроме себя, и только войдя. */
function canFollow(address: string): boolean {
  return authStore.isAuthenticated && address !== myAddress.value
}

/** Транзакция идёт или подписки ещё не пришли с ноды. */
function followBusy(address: string): boolean {
  return relations.isSubscribePending(address) || !relations.isSubscriptionKnown(address)
}

function followLabel(address: string): string {
  if (!relations.isSubscriptionKnown(address)) return t('relations.loading')
  return relations.isSubscribed(address)
    ? t('subscriptions.subscribed')
    : t('subscriptions.subscribe')
}

function nameOf(address: string): string {
  return store.profiles[address]?.name || `${address.slice(0, 8)}…`
}

function avatarOf(address: string): string | undefined {
  const profile = store.profiles[address]
  return profile ? (resolveAvatarUrl(profile) ?? undefined) : undefined
}

function profilePath(address: string): string {
  const name = store.profiles[address]?.name
  return name ? `/${name.toLowerCase()}` : `/${address}`
}

/** «С 2019 · 1,2 тыс. подписчиков · 56 постов». */
function metaOf(address: string): string {
  const profile = store.profiles[address]
  if (!profile) return ''
  const parts: string[] = []
  const year = registrationYear(profile.regdate)
  if (year) parts.push(t('topAccounts.since', { year }))
  const subscribers = profile.subscribers_count ?? 0
  parts.push(
    t('topAccounts.subscribers', { n: formatTopCount(subscribers) }, pluralCount(subscribers))
  )
  const posts = profile.postcnt ?? 0
  parts.push(t('topAccounts.posts', { n: formatTopCount(posts) }, pluralCount(posts)))
  return parts.join(' · ')
}

/** Для «1,2 тыс.» форма слова — как у тысячи: «1,2 тыс. подписчиков», а не «подписчика». */
function pluralCount(n: number): number {
  return n >= 1000 ? 1000 : n
}
</script>
