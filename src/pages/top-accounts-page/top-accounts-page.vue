<template>
  <SC_TopWork>
    <SC_TopPage>
      <SC_TopHeader>
        <SC_TopTitle>{{ t('topAccounts.title') }}</SC_TopTitle>
        <Segmented
          v-model:value="sort"
          :options="sortOptions"
          :aria-label="t('topAccounts.sortLabel')"
        />
      </SC_TopHeader>
      <SC_TopNote>
        {{
          sort === 'pkoin'
            ? t('topAccounts.noteBalance', { n: TOP_SIZE })
            : t('topAccounts.noteReputation', { n: TOP_SIZE })
        }}
      </SC_TopNote>

      <SC_TopStatus v-if="store.status === 'error'" role="alert">
        {{ t('topAccounts.failed') }}
        <Button @click="store.load(true)">{{ t('topAccounts.retry') }}</Button>
      </SC_TopStatus>

      <template v-else-if="store.status !== 'ready' || (sort === 'pkoin' && !balancesReady)">
        <SC_Progress v-if="store.status === 'ready'" role="status">
          {{
            t('topAccounts.balancesProgress', {
              done: store.balancesDone,
              total: store.entries.length,
            })
          }}
          <SC_ProgressTrack>
            <SC_ProgressBar :done="store.balancesDone / Math.max(1, store.entries.length)" />
          </SC_ProgressTrack>
        </SC_Progress>
        <SC_TopStatus v-else role="status">{{ t('topAccounts.loading') }}</SC_TopStatus>
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
              <SC_Metric class="secondary-metric"><Skeleton :width="80" :height="14" /></SC_Metric>
            </SC_TopRowStatic>
          </SC_TopItem>
        </SC_TopList>
      </template>

      <SC_TopList v-else data-testid="top-accounts">
        <SC_TopItem
          v-for="(entry, index) in shown"
          :key="entry.address"
          :class="{ me: entry.address === myAddress }"
        >
          <router-link v-slot="{ href, navigate }" :to="profilePath(entry.address)" custom>
            <SC_TopRow :href="href" @click="navigate">
              <SC_Rank :class="{ podium: index < 3 }">{{ index + 1 }}</SC_Rank>
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
              <SC_Metric
                :class="{
                  primary: sort === 'reputation',
                  'secondary-metric': sort !== 'reputation',
                }"
              >
                <span class="metric-value">{{ formatTopReputation(entry.reputation) }}</span>
                <span class="metric-label">{{ t('topAccounts.reputation') }}</span>
              </SC_Metric>
              <SC_Metric
                :class="{ primary: sort === 'pkoin', 'secondary-metric': sort !== 'pkoin' }"
              >
                <span class="metric-value">
                  <Skeleton v-if="!(entry.address in store.balances)" :width="70" :height="14" />
                  <template v-else>{{ balanceText(entry.address) }}</template>
                </span>
                <span class="metric-label">PKOIN</span>
              </SC_Metric>
            </SC_TopRow>
          </router-link>
        </SC_TopItem>
        <SC_Sentinel v-if="shown.length < list.length" ref="sentinelRef" aria-hidden="true" />
      </SC_TopList>
    </SC_TopPage>
  </SC_TopWork>
</template>

<script setup lang="ts">
// Топ аккаунтов: по репутации или по PKOIN. Список собирается один раз (см.
// services/top-accounts), а строки показываются по 30 — следующие, когда
// долистали до конца; профили и балансы догружаются только у показанных.
// «По PKOIN» сначала узнаёт балансы всего топа: иначе места были бы неверны.

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Segmented } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import { useAuthStore } from '@/blockchain'
import { useTopAccountsStore } from '@/stores/top-accounts-store'
import { TOP_SIZE } from '@/services/top-accounts'
import { userMarkOf } from '@/services/user-marks'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import { useViewport } from '@/composables/use-viewport'
import {
  formatTopBalance,
  formatTopCount,
  formatTopReputation,
  registrationYear,
} from './top-format'
import {
  SC_Meta,
  SC_Metric,
  SC_Name,
  SC_Progress,
  SC_ProgressBar,
  SC_ProgressTrack,
  SC_Rank,
  SC_Sentinel,
  SC_TopHeader,
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

type TopSort = 'reputation' | 'pkoin'

/** Сколько строк добавлять за раз. */
const PAGE = 30

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useTopAccountsStore()
const authStore = useAuthStore()
const myAddress = computed(() => authStore.getUserAddress ?? '')
const { isMobile } = useViewport()

// Порядок — в адресе (`?sort=pkoin`): ссылкой можно поделиться, «Назад» его помнит.
const sort = computed<TopSort>({
  get: () => (route.query.sort === 'pkoin' ? 'pkoin' : 'reputation'),
  set: (value) => {
    void router.replace({
      query: { ...route.query, sort: value === 'pkoin' ? 'pkoin' : undefined },
    })
  },
})
const sortOptions = computed(() => [
  { value: 'reputation', label: t('topAccounts.byReputation') },
  { value: 'pkoin', label: t('topAccounts.byBalance') },
])

const list = computed(() => (sort.value === 'pkoin' ? store.byBalance : store.entries))
const limit = ref(PAGE)
const shown = computed(() => list.value.slice(0, limit.value))
const balancesReady = computed(() => store.balancesDone >= store.entries.length)

void store.load()

// Сменили порядок — список снова с начала.
watch(sort, () => {
  limit.value = PAGE
})

// «По PKOIN» — сначала балансы всего топа.
watch(
  () => [sort.value, store.entries.length] as const,
  ([value]) => {
    if (value === 'pkoin' && store.entries.length) {
      void store.ensureBalances(store.entries.map((e) => e.address))
    }
  },
  { immediate: true }
)

// Показанным строкам — профили, а «по репутации» ещё и балансы.
watch(
  () => shown.value.map((e) => e.address).join(','),
  () => {
    const addresses = shown.value.map((e) => e.address)
    void store.ensureProfiles(addresses)
    if (sort.value === 'reputation') void store.ensureBalances(addresses)
  },
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

/**
 * «С 2019 · 1,2 тыс. подписчиков · 56 постов». На телефоне второго столбца
 * нет — его число встаёт первым: «12 345 PKOIN · …» или «Репутация 9 876 · …».
 */
function metaOf(address: string): string {
  const profile = store.profiles[address]
  if (!profile) return ''
  const parts: string[] = []
  if (isMobile.value) {
    const entry = store.entries.find((e) => e.address === address)
    if (sort.value === 'pkoin' && entry) {
      parts.push(`${t('topAccounts.reputation')} ${formatTopReputation(entry.reputation)}`)
    } else if (sort.value === 'reputation' && typeof store.balances[address] === 'number') {
      parts.push(`${balanceText(address)} PKOIN`)
    }
  }
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

function balanceText(address: string): string {
  const balance = store.balances[address]
  return typeof balance === 'number' ? formatTopBalance(balance) : '—'
}
</script>
