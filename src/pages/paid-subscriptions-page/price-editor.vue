<template>
  <SC_PaidCard>
    <SC_PaidSectionTitle>{{ t('paidSubscriptions.price.title') }}</SC_PaidSectionTitle>
    <SC_PaidLead>{{ t('paidSubscriptions.price.lead') }}</SC_PaidLead>

    <SC_PriceState v-if="current === undefined" class="pending">
      <LoadingOutlined spin />
      {{ t('paidSubscriptions.price.loading') }}
    </SC_PriceState>
    <template v-else>
      <SC_PriceState :class="{ pending: !!store.pricePending }">
        <ClockCircleOutlined v-if="store.pricePending" />
        <span v-if="current > 0">
          {{ t('paidSubscriptions.price.current') }}
          <strong>{{
            t('paidSubscriptions.perMonth', { price: formatPkoin(current * SATOSHI) })
          }}</strong>
        </span>
        <span v-else-if="current < 0">{{ t('paidSubscriptions.price.off') }}</span>
        <span v-else>{{ t('paidSubscriptions.price.notSet') }}</span>
        <span v-if="store.pricePending">· {{ t('paidSubscriptions.price.pending') }}</span>
      </SC_PriceState>

      <SC_PriceRow>
        <SC_PriceField>
          {{ t('paidSubscriptions.price.label') }}
          <SC_PriceInput
            v-model="input"
            type="number"
            inputmode="numeric"
            :min="MIN_PRICE"
            :max="MAX_PRICE"
            step="1"
            :placeholder="t('paidSubscriptions.price.placeholder')"
            :disabled="saving"
            @keydown.enter="submit"
          />
        </SC_PriceField>
        <SC_PriceActions>
          <Button type="primary" :loading="saving" :disabled="!canSave" @click="submit">
            {{
              current > 0 ? t('paidSubscriptions.price.save') : t('paidSubscriptions.price.enable')
            }}
          </Button>
          <Button v-if="current > 0" danger :disabled="saving" @click="confirmDisable">
            {{ t('paidSubscriptions.price.disable') }}
          </Button>
        </SC_PriceActions>
      </SC_PriceRow>

      <SC_FieldError v-if="input && !valid">{{
        t('paidSubscriptions.price.invalid')
      }}</SC_FieldError>
      <SC_PriceTerms v-else-if="valid">
        <span v-for="plan in PAID_PLANS" :key="plan.id">
          {{ t(`paidSubscriptions.plans.${plan.id}`) }}:
          <strong>{{ formatPkoin(planCost(numeric, plan)) }} PKOIN</strong>
        </span>
      </SC_PriceTerms>

      <SC_PaidLead>{{ t('paidSubscriptions.price.howToPost') }}</SC_PaidLead>
    </template>
  </SC_PaidCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'
import { ClockCircleOutlined, LoadingOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import {
  MAX_PRICE,
  MIN_PRICE,
  PAID_PLANS,
  SATOSHI,
  isValidPrice,
  planCost,
} from '@/helpers/paid-subscription/plans'
import { formatPkoin } from '@/helpers/paid-subscription/format'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import {
  SC_PaidCard,
  SC_PaidSectionTitle,
  SC_PaidLead,
  SC_PriceState,
  SC_PriceRow,
  SC_PriceField,
  SC_PriceInput,
  SC_PriceActions,
  SC_PriceTerms,
  SC_FieldError,
} from './paid-subscriptions-page.styled'

/** Пока сеть не подтвердила новую цену, спрашиваем ноду раз в 20 секунд. */
const PENDING_POLL_MS = 20_000

const { t } = useI18n()
const authStore = useAuthStore()
const store = usePaidSubscriptionsStore()

const me = computed(() => authStore.getUserAddress || '')
const current = computed(() => store.priceOf(me.value))

const input = ref('')
const saving = ref(false)
const numeric = computed(() => Number(input.value))
const valid = computed(() => input.value !== '' && isValidPrice(numeric.value))
const canSave = computed(() => valid.value && numeric.value !== current.value && !saving.value)

// Поле — с текущей ценой, когда она пришла (и после смены).
watch(
  current,
  (price) => {
    if (price !== undefined && price > 0) input.value = String(price)
  },
  { immediate: true }
)

let poll: ReturnType<typeof setInterval> | null = null
watch(
  () => !!store.pricePending,
  (pending) => {
    if (pending && !poll) {
      poll = setInterval(() => void store.ensurePrice(me.value, true), PENDING_POLL_MS)
    } else if (!pending && poll) {
      clearInterval(poll)
      poll = null
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})

async function save(value: number): Promise<void> {
  saving.value = true
  try {
    await store.savePrice(value)
    appToast.success({
      message:
        value > 0 ? t('paidSubscriptions.price.saved') : t('paidSubscriptions.price.disabled'),
    })
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('paidSubscriptions.errFailed') })
  } finally {
    saving.value = false
  }
}

function submit(): void {
  if (!canSave.value) return
  const value = numeric.value
  // Новая цена действует и для уже оплативших: у кого теперь не хватает — посты закроются.
  if (current.value !== undefined && current.value > 0) {
    Modal.confirm({
      title: t('paidSubscriptions.price.changeTitle'),
      content: t('paidSubscriptions.price.changeConfirm'),
      okText: t('paidSubscriptions.price.save'),
      cancelText: t('paidSubscriptions.cancel'),
      onOk: () => save(value),
    })
    return
  }
  void save(value)
}

function confirmDisable(): void {
  Modal.confirm({
    title: t('paidSubscriptions.price.disableTitle'),
    content: t('paidSubscriptions.price.disableConfirm'),
    okText: t('paidSubscriptions.price.disable'),
    okType: 'danger',
    cancelText: t('paidSubscriptions.cancel'),
    onOk: () => save(-1),
  })
}
</script>
