<template>
  <Modal
    :open="store.modal.open"
    :width="460"
    :centered="true"
    :closable="!paying"
    :mask-closable="!paying"
    :z-index="2700"
    :title="t('paidSubscriptions.modal.title')"
    @cancel="close"
  >
    <SC_ModalBody>
      <SC_PaidBody>
        <SC_PaidAuthor>
          <Avatar
            :src="avatar ?? undefined"
            alt=""
            :fallback-text="name"
            :size="40"
            shape="circle"
          />
          <SC_PaidAuthorText>
            <SC_PaidAuthorName>{{ name }}</SC_PaidAuthorName>
            <SC_PaidAuthorPrice v-if="price && price > 0">
              {{ t('paidSubscriptions.perMonth', { price: formatPkoin(price * SATOSHI) }) }}
            </SC_PaidAuthorPrice>
          </SC_PaidAuthorText>
        </SC_PaidAuthor>

        <SC_PaidCenter v-if="!status && !failed">
          <Spin />
          <span>{{ t('paidSubscriptions.modal.loading') }}</span>
        </SC_PaidCenter>

        <SC_PaidCenter v-else-if="!status">
          <span>{{ t('paidSubscriptions.modal.error') }}</span>
          <Button size="small" @click="reload">{{ t('paidSubscriptions.retry') }}</Button>
        </SC_PaidCenter>

        <SC_PaidText v-else-if="status.kind === 'unavailable'">
          {{ t('paidSubscriptions.modal.unavailable') }}
        </SC_PaidText>

        <SC_PaidText v-else-if="status.kind === 'open'">
          {{ t('paidSubscriptions.modal.open') }}
        </SC_PaidText>

        <template v-else>
          <SC_PaidStatus v-if="status.kind === 'active'" class="active" role="status">
            <CheckCircleOutlined />
            {{ t('paidSubscriptions.modal.activeUntil', { date: formatTermDate(status.until) }) }}
          </SC_PaidStatus>
          <SC_PaidStatus v-else-if="status.endedAt" role="status">
            {{ t('paidSubscriptions.modal.endedAt', { date: formatTermDate(status.endedAt) }) }}
          </SC_PaidStatus>

          <SC_PaidText v-if="status.kind === 'inactive'">
            {{ t('paidSubscriptions.modal.lead') }}
          </SC_PaidText>

          <SC_PaidText v-if="!purchaseSupported">
            {{ t('paidSubscriptions.modal.unsupported') }}
          </SC_PaidText>

          <SC_PaidText v-else-if="!status.offers.length">
            {{ t('paidSubscriptions.modal.nothingToPay') }}
          </SC_PaidText>

          <template v-else>
            <SC_PlanList role="radiogroup" :aria-label="t('paidSubscriptions.modal.choose')">
              <SC_PlanOption
                v-for="offer in status.offers"
                :key="offer.plan"
                type="button"
                role="radio"
                :aria-checked="offer.plan === selectedPlan"
                :class="{ selected: offer.plan === selectedPlan }"
                :disabled="paying"
                @click="selectedPlan = offer.plan"
              >
                <SC_PlanRadio aria-hidden="true" />
                <SC_PlanText>
                  <span>
                    <SC_PlanName>{{ t(`paidSubscriptions.plans.${offer.plan}`) }}</SC_PlanName>
                    <SC_PlanSaving v-if="!offer.topUp && SAVINGS[offer.plan]">
                      {{ t('paidSubscriptions.modal.saving', { percent: SAVINGS[offer.plan] }) }}
                    </SC_PlanSaving>
                  </span>
                  <SC_PlanUntil>
                    {{ t('paidSubscriptions.modal.until', { date: formatTermDate(offer.until) }) }}
                  </SC_PlanUntil>
                </SC_PlanText>
                <SC_PlanAmount>
                  {{ formatPkoin(offer.amount) }} PKOIN
                  <SC_PlanAmountNote v-if="offer.topUp">
                    {{ t('paidSubscriptions.modal.topUp', { cost: formatPkoin(offer.cost) }) }}
                  </SC_PlanAmountNote>
                </SC_PlanAmount>
              </SC_PlanOption>
            </SC_PlanList>

            <SC_PaidText v-if="!following">{{
              t('paidSubscriptions.modal.willSubscribe')
            }}</SC_PaidText>

            <SC_PaidError v-if="insufficient">
              {{ t('paidSubscriptions.modal.insufficient') }}
            </SC_PaidError>
            <SC_PaidNote v-else-if="balance !== null">
              {{ t('paidSubscriptions.modal.balance', { amount: formatPkoin(balance) }) }}
            </SC_PaidNote>

            <SC_PaidNote>{{ t('paidSubscriptions.modal.howItWorks') }}</SC_PaidNote>

            <!-- Перевод не отменить: без галочки кнопка оплаты не нажимается. -->
            <SC_PaidConfirm v-if="selectedOffer">
              <Checkbox v-model:checked="confirmed" :disabled="paying">
                {{
                  t('paidSubscriptions.modal.confirm', {
                    amount: formatPkoin(selectedOffer.amount),
                    name,
                  })
                }}
              </Checkbox>
            </SC_PaidConfirm>
          </template>
        </template>
      </SC_PaidBody>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button :disabled="paying" @click="close">{{ t('paidSubscriptions.close') }}</Button>
        <Button
          v-if="selectedOffer"
          type="primary"
          :loading="paying"
          :disabled="insufficient || !confirmed"
          @click="onPay"
        >
          {{ t('paidSubscriptions.modal.pay', { amount: formatPkoin(selectedOffer.amount) }) }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Checkbox, Modal, Spin } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import { CheckCircleOutlined } from '@/components/icons'
import { SC_ModalActions, SC_ModalBody } from '@/components/modal'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import {
  filterAvailableUnspents,
  getUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { transferFeeSatoshis } from '@/blockchain/core/transactions/transfer-fee'
import { SATOSHI, type PaidPlanId } from '@/helpers/paid-subscription/plans'
import { formatPkoin, formatTermDate } from '@/helpers/paid-subscription/format'
import { userAvatar, userName } from '@/services/user-names'
import { useEffectsStore } from '@/stores/effects-store'
import { playSound } from '@/services/app-sounds'
import { paidPurchaseSupported, usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import {
  SC_PaidBody,
  SC_PaidAuthor,
  SC_PaidAuthorText,
  SC_PaidAuthorName,
  SC_PaidAuthorPrice,
  SC_PaidStatus,
  SC_PaidText,
  SC_PaidNote,
  SC_PaidError,
  SC_PaidCenter,
  SC_PlanList,
  SC_PlanOption,
  SC_PlanRadio,
  SC_PlanText,
  SC_PlanName,
  SC_PlanSaving,
  SC_PlanUntil,
  SC_PlanAmount,
  SC_PlanAmountNote,
  SC_PaidConfirm,
} from './styled'

/** Выгода длинного срока против помесячной оплаты, %: 1 − 5,5/6 и 1 − 10/12. */
const SAVINGS: Partial<Record<PaidPlanId, number>> = { '6m': 8, '1y': 17 }

const { t } = useI18n()
const store = usePaidSubscriptionsStore()
const relations = useUserRelationsStore()
const authStore = useAuthStore()
const effects = useEffectsStore()

const author = computed(() => store.modal.author)
const name = computed(() => userName(author.value))
const avatar = computed(() => userAvatar(author.value))
const price = computed(() => store.priceOf(author.value))
const status = computed(() => store.statusFor(author.value))
const following = computed(() => relations.isSubscribed(author.value))
const purchaseSupported = paidPurchaseSupported()

/** Цену или платежи не узнали — показываем «повторить», а не вечную загрузку. */
const failed = ref(false)
const paying = ref(false)
const selectedPlan = ref<PaidPlanId>('1m')

const offers = computed(() => {
  const s = status.value
  return s && (s.kind === 'active' || s.kind === 'inactive') && purchaseSupported ? s.offers : []
})
const selectedOffer = computed(() => offers.value.find((o) => o.plan === selectedPlan.value))

/** Галочка подтверждения: сбрасывается при смене срока — у другого срока другая сумма. */
const confirmed = ref(false)
watch(selectedPlan, () => {
  confirmed.value = false
})

// По умолчанию — самый короткий из доступных сроков.
watch(
  offers,
  (list) => {
    if (list.length && !list.some((o) => o.plan === selectedPlan.value)) {
      selectedPlan.value = list[0]!.plan
    }
  },
  { immediate: true }
)

/** Доступный баланс основного кошелька, сатоши. */
const balance = ref<number | null>(null)
const insufficient = computed(
  () =>
    balance.value !== null &&
    !!selectedOffer.value &&
    balance.value <
      selectedOffer.value.amount +
        transferFeeSatoshis({ inputs: 1, outputs: 1, messageBytes: 'a:subscription'.length })
)

async function loadBalance(): Promise<void> {
  balance.value = null
  const address = authStore.getUserAddress
  if (!address) return
  try {
    const unspents = filterAvailableUnspents(await getUnspents(address, 1, 9999999), false)
    balance.value = Math.round(unspents.reduce((sum, u) => sum + (u.amount || 0), 0) * SATOSHI)
  } catch (e) {
    console.warn('[PaidSubscription] balance load failed', e)
  }
}

async function reload(): Promise<void> {
  failed.value = false
  await Promise.all([store.ensurePrice(author.value, true), store.ensureMyPayments(true)])
  failed.value = !store.statusFor(author.value)
}

watch(
  () => store.modal.open,
  (open) => {
    if (!open) return
    failed.value = false
    selectedPlan.value = '1m'
    confirmed.value = false
    void loadBalance()
    void Promise.all([store.ensurePrice(author.value), store.ensureMyPayments()]).then(() => {
      if (store.modal.open && !store.statusFor(author.value)) failed.value = true
    })
  }
)

function close(): void {
  if (!paying.value) store.closeModal()
}

async function onPay(): Promise<void> {
  const offer = selectedOffer.value
  if (!offer || paying.value || !confirmed.value) return
  paying.value = true
  try {
    const { subscribeFailed } = await store.pay(author.value, offer)
    appToast.success({ message: t('paidSubscriptions.modal.sent') })
    playSound('coin')
    if (subscribeFailed) appToast.warning({ message: t('paidSubscriptions.modal.subscribeFailed') })
    store.closeModal()
    if (typeof window !== 'undefined') {
      effects.triggerCoins(window.innerWidth / 2, window.innerHeight / 3)
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('paidSubscriptions.errFailed') })
  } finally {
    paying.value = false
  }
}
</script>
