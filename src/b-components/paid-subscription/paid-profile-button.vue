<template>
  <!-- Свой профиль: цена и подписчики — на странице платных подписок. -->
  <SC_PaidProfileButton v-if="isOwn" type="button" @click="openOwnPage">
    <CrownOutlined />
    {{ ownLabel }}
  </SC_PaidProfileButton>

  <!-- Чужой: оформить или продлить. Без цены автора кнопки нет. -->
  <SC_PaidProfileButton
    v-else-if="price !== undefined && price > 0"
    type="button"
    :class="{ active: activeUntil !== null }"
    :aria-haspopup="'dialog'"
    @click="openModal"
  >
    <CrownOutlined />
    {{ otherLabel }}
  </SC_PaidProfileButton>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CrownOutlined } from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { requireAuth } from '@/composables/use-auth-gate'
import { SATOSHI } from '@/helpers/paid-subscription/plans'
import { formatPkoin, formatTermDate } from '@/helpers/paid-subscription/format'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { SC_PaidProfileButton } from './styled'

const props = defineProps<{
  address: string
  /** Настройки аккаунта, если страница профиля их уже загрузила (accSet). */
  settings?: Record<string, unknown> | null
}>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const store = usePaidSubscriptionsStore()

const isOwn = computed(() => !!props.address && props.address === authStore.getUserAddress)
const price = computed(() => store.priceOf(props.address))

const activeUntil = computed<number | null>(() => {
  const status = store.statusFor(props.address)
  return status?.kind === 'active' ? status.until : null
})

const perMonth = computed(() =>
  price.value && price.value > 0 ? formatPkoin(price.value * SATOSHI) : ''
)

const ownLabel = computed(() =>
  perMonth.value
    ? t('paidSubscriptions.profile.ownWithPrice', { price: perMonth.value })
    : t('paidSubscriptions.profile.own')
)

const otherLabel = computed(() =>
  activeUntil.value !== null
    ? t('paidSubscriptions.profile.active', { date: formatTermDate(activeUntil.value) })
    : t('paidSubscriptions.profile.subscribe', { price: perMonth.value })
)

// Цена — из уже загруженных настроек профиля, иначе спросим ноду.
watch(
  () => [props.address, props.settings] as const,
  ([address, settings]) => {
    if (!address) return
    if (settings) store.rememberSettings(address, settings)
    else void store.ensurePrice(address)
    if (authStore.getUserAddress && address !== authStore.getUserAddress) {
      void store.ensureMyPayments()
    }
  },
  { immediate: true }
)

function openOwnPage(): void {
  void router.push({ name: 'paid-subscriptions', query: { tab: 'subscribers' } })
}

function openModal(): void {
  requireAuth(() => store.openModal(props.address))
}
</script>
