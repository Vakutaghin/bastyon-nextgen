<template>
  <SC_ChannelRoom>
    <SC_ChannelFeed ref="feedRef" data-testid="channel-feed" @scroll="onScroll">
      <SC_FeedStatus v-if="isLoadingOlder">
        <SC_Spinner />
      </SC_FeedStatus>
      <SC_FeedStatus v-else-if="!hasOlder && posts.length > 0">
        {{ t('messenger.channel.start') }}
      </SC_FeedStatus>

      <template v-for="item in items" :key="item.key">
        <SC_DayDivider v-if="item.day">
          <span>{{ item.day }}</span>
        </SC_DayDivider>
        <SC_NewDivider v-else-if="item.isNew" class="new-divider" data-testid="channel-new-divider">
          <span>{{ t('messenger.channel.newDivider') }}</span>
        </SC_NewDivider>
        <ChannelPost v-else-if="item.post" :post="item.post" />
      </template>

      <SC_FeedStatus v-if="isLoading">
        <SC_Spinner />
        {{ t('messenger.channel.loading') }}
      </SC_FeedStatus>
      <SC_FeedStatus v-else-if="failed">
        {{ t('messenger.channel.loadFailed') }}
        <SC_RetryButton type="button" @click="retry">{{
          t('messenger.channel.retry')
        }}</SC_RetryButton>
      </SC_FeedStatus>
      <SC_FeedStatus v-else-if="posts.length === 0">
        {{ t('messenger.channel.noPosts') }}
      </SC_FeedStatus>
    </SC_ChannelFeed>
    <!-- Поля ввода нет: канал читают. Написать автору — значок в шапке
         (ChatPartnerTitle), подписка — в профиле автора. -->
  </SC_ChannelRoom>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { postVisibilityOf } from '@/helpers/content/post-visibility'
import { formatDayLabel } from '@/helpers/common/date-formatter'
import type { AdaptedPost } from '@/types/adapted-post'
import { postTime } from '../../lib/channels'
import ChannelPost from './channel-post.vue'
import { useChannelFeed } from './use-channel-feed'
import {
  SC_ChannelFeed,
  SC_ChannelRoom,
  SC_DayDivider,
  SC_FeedStatus,
  SC_NewDivider,
  SC_RetryButton,
  SC_Spinner,
} from './styled'

const props = defineProps<{ address: string }>()
const { t } = useI18n()

const { posts, isLoading, isLoadingOlder, hasOlder, failed, seenAtOpen, loadOlder, retry } =
  useChannelFeed(props.address)

interface Item {
  key: string
  day?: string
  isNew?: boolean
  post?: AdaptedPost
}

/** Посты с подписями дней и чертой «Новые публикации» перед первым непрочитанным. */
const items = computed<Item[]>(() => {
  const out: Item[] = []
  let lastDay = ''
  let newShown = false
  for (const post of posts.value) {
    const time = postTime(post)
    const day = new Date(time).toDateString()
    if (day !== lastDay) {
      out.push({ key: `day-${day}`, day: formatDayLabel(time) })
      lastDay = day
    }
    if (!newShown && seenAtOpen > 0 && time > seenAtOpen) {
      out.push({ key: 'new', isNew: true })
      newShown = true
    }
    out.push({ key: post.txid || String(post.id), post })
  }
  return out
})

// --- Прокрутка: открываемся на новом, старое — вверх ---

const feedRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
const feedEl = (): HTMLElement | null => {
  const r = feedRef.value
  return r instanceof HTMLElement ? r : (r?.$el ?? null)
}

/** У нижнего края: новые посты прокручивают ленту к себе. */
let atBottom = true
const NEAR = 120

function onScroll(): void {
  const el = feedEl()
  if (!el) return
  atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR
  if (el.scrollTop < 200) void loadOlderKeepingPlace()
}

/** Старые посты встают сверху, а видимое остаётся на месте. */
async function loadOlderKeepingPlace(): Promise<void> {
  const el = feedEl()
  if (!el || isLoadingOlder.value || !hasOlder.value) return
  const height = el.scrollHeight
  const top = el.scrollTop
  await loadOlder()
  await nextTick()
  el.scrollTop = top + (el.scrollHeight - height)
}

/** Первый показ: к черте «Новые публикации», без неё — вниз, к свежему. */
async function scrollToStart(): Promise<void> {
  await nextTick()
  const el = feedEl()
  if (!el) return
  const divider = el.querySelector<HTMLElement>('.new-divider')
  el.scrollTop = divider ? divider.offsetTop - el.offsetTop - 8 : el.scrollHeight
  atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR
  // Лента короче окна — сразу подгружаем раньшие посты.
  if (el.scrollHeight <= el.clientHeight + 100) void loadOlderKeepingPlace()
}

const stopFirst = watch(isLoading, (loading) => {
  if (loading) return
  stopFirst()
  void scrollToStart()
})

// Новый пост пришёл, пока канал открыт.
watch(
  () => posts.value[posts.value.length - 1]?.txid,
  async (txid, prev) => {
    if (!prev || txid === prev || !atBottom) return
    await nextTick()
    const el = feedEl()
    if (el) el.scrollTop = el.scrollHeight
  }
)

// Платные посты открыты тем, кто платит, — узнаём цену и свои оплаты, как в ленте.
const paidSubscriptions = usePaidSubscriptionsStore()
watch(
  () => posts.value.some((p) => postVisibilityOf(p.settings?.f) === 'paid'),
  (hasPaid) => {
    if (!hasPaid) return
    void paidSubscriptions.ensurePrice(props.address)
    void paidSubscriptions.ensureMyPayments()
  },
  { immediate: true }
)
</script>
