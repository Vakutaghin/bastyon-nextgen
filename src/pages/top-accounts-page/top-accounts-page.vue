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
              <SC_Metric>
                <span class="metric-value">{{ formatTopReputation(entry.reputation) }}</span>
                <span class="metric-label">{{ t('topAccounts.reputation') }}</span>
              </SC_Metric>
            </SC_TopRow>
          </router-link>
        </SC_TopItem>
        <SC_Sentinel
          v-if="shown.length < store.entries.length"
          ref="sentinelRef"
          aria-hidden="true"
        />
      </SC_TopList>
    </SC_TopPage>
  </SC_TopWork>
</template>

<script setup lang="ts">
// Топ аккаунтов по репутации. Список собирается один раз (см.
// services/top-accounts), а строки показываются по 30 — следующие, когда
// долистали до конца; профили догружаются только у показанных.

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import { useAuthStore } from '@/blockchain'
import { useTopAccountsStore } from '@/stores/top-accounts-store'
import { TOP_SIZE } from '@/services/top-accounts'
import { userMarkOf } from '@/services/user-marks'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import { formatTopCount, formatTopReputation, registrationYear } from './top-format'
import {
  SC_Meta,
  SC_Metric,
  SC_Name,
  SC_Rank,
  SC_Sentinel,
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

const limit = ref(PAGE)
const shown = computed(() => store.entries.slice(0, limit.value))

void store.load()

// Показанным строкам — профили.
watch(
  () => shown.value.map((e) => e.address).join(','),
  () => void store.ensureProfiles(shown.value.map((e) => e.address)),
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
