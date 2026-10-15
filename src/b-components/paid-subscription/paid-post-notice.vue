<template>
  <SC_PaidNotice role="note">
    <SC_PaidNoticeText>
      <LoadingOutlined v-if="access === 'checking'" spin />
      <LockOutlined v-else />
      <span>{{ text }}</span>
    </SC_PaidNoticeText>

    <SC_PaidNoticeAction v-if="access === 'buy'" type="button" @click="openModal">
      <CrownOutlined />
      {{ buyLabel }}
    </SC_PaidNoticeAction>
    <SC_PaidNoticeAction
      v-else-if="access === 'follow'"
      type="button"
      :disabled="relations.isSubscribePending(author)"
      @click="follow"
    >
      {{ t('subscriptions.subscribe') }}
    </SC_PaidNoticeAction>
    <SC_PaidNoticeAction v-else-if="access === 'guest'" type="button" @click="openModal">
      {{ t('paidSubscriptions.post.guestAction') }}
    </SC_PaidNoticeAction>
    <SC_PaidNoticeAction
      v-else-if="access === 'error'"
      type="button"
      class="secondary"
      @click="retry"
    >
      {{ t('paidSubscriptions.retry') }}
    </SC_PaidNoticeAction>
  </SC_PaidNotice>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { CrownOutlined, LoadingOutlined, LockOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { requireAuth } from '@/composables/use-auth-gate'
import { SATOSHI } from '@/helpers/paid-subscription/plans'
import { formatPkoin } from '@/helpers/paid-subscription/format'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import { SC_PaidNotice, SC_PaidNoticeText, SC_PaidNoticeAction } from './styled'

/** Пост «для платных подписчиков», закрытый для смотрящего: что не так и как открыть. */
const props = defineProps<{ author: string }>()

const { t } = useI18n()
const store = usePaidSubscriptionsStore()
const relations = useUserRelationsStore()

const access = computed(() => store.accessFor(props.author))
const price = computed(() => store.priceOf(props.author))

const text = computed<string>(() => {
  switch (access.value) {
    case 'checking':
      return t('paidSubscriptions.post.checking')
    case 'follow':
      // Автор отключил подписку — пост открыт его подписчикам.
      return (price.value ?? 0) < 0
        ? t('paidSubscriptions.post.followOpen')
        : t('paidSubscriptions.post.follow')
    case 'unavailable':
      return t('paidSubscriptions.post.unavailable')
    case 'error':
      return t('paidSubscriptions.post.error')
    case 'guest':
      return t('paidSubscriptions.post.guest')
    case 'unsupported':
      return t('paidSubscriptions.post.unsupported')
    default:
      return t('paidSubscriptions.post.buy')
  }
})

const buyLabel = computed(() =>
  price.value && price.value > 0
    ? t('paidSubscriptions.post.buyAction', { price: formatPkoin(price.value * SATOSHI) })
    : t('paidSubscriptions.post.buyActionShort')
)

onMounted(() => {
  void store.ensurePrice(props.author)
  void store.ensureMyPayments()
})

function openModal(): void {
  // Гость сначала входит, потом окно откроется само.
  requireAuth(() => store.openModal(props.author))
}

async function follow(): Promise<void> {
  try {
    await relations.subscribe(props.author)
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('paidSubscriptions.errFailed') })
  }
}

function retry(): void {
  void store.ensurePrice(props.author, true)
  void store.ensureMyPayments(true)
}
</script>
