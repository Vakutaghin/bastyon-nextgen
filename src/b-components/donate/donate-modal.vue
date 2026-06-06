<template>
  <Modal
    :open="donateStore.isOpen"
    :width="420"
    :centered="true"
    :closable="!sending"
    :mask-closable="!sending"
    :z-index="2700"
    :title="t('donate.title')"
    @cancel="handleCancel"
  >
    <SC_ModalBody>
      <SC_DonateBody>
        <SC_Recipient>
          {{ t('donate.to') }} <strong>{{ recipientLabel }}</strong>
        </SC_Recipient>

        <SC_PresetRow>
          <SC_PresetBtn
            v-for="preset in PRESETS"
            :key="preset"
            type="button"
            :class="{ active: Number(amount) === preset }"
            :disabled="sending"
            @click="amount = String(preset)"
          >
            {{ preset }}
          </SC_PresetBtn>
        </SC_PresetRow>

        <SC_AmountInput
          v-model="amount"
          type="number"
          step="0.0001"
          min="0"
          inputmode="decimal"
          :placeholder="t('donate.amountPlaceholder')"
          :disabled="sending"
        />

        <SC_BalanceHint v-if="balance !== null">
          {{ t('donate.available', { amount: formattedBalance }) }}
        </SC_BalanceHint>

        <SC_FieldError v-if="validationError">{{ validationError }}</SC_FieldError>
      </SC_DonateBody>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" :disabled="sending" @click="handleCancel">
          {{ t('donate.cancel') }}
        </Button>
        <Button type="primary" :loading="sending" :disabled="!canSend" @click="onSend">
          {{ t('donate.send') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { useDonateStore } from '@/stores'
import { useEffectsStore } from '@/stores/effects-store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import {
  getUnspents,
  filterAvailableUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { SC_ModalBody, SC_ModalActions } from '@/components/modal'
import {
  SC_DonateBody,
  SC_Recipient,
  SC_PresetRow,
  SC_PresetBtn,
  SC_AmountInput,
  SC_BalanceHint,
  SC_FieldError,
} from './styled'

/** Пресеты быстрых сумм доната (PKOIN). */
const PRESETS = [1, 5, 10, 50]

const { t } = useI18n()
const donateStore = useDonateStore()
const effectsStore = useEffectsStore()
const authStore = useAuthStore()

const amount = ref('')
const sending = ref(false)
const balance = ref<number | null>(null)

const recipientLabel = computed<string>(() => donateStore.name || donateStore.address)
const formattedBalance = computed<string>(() =>
  balance.value === null ? '' : balance.value.toFixed(4)
)

const numericAmount = computed<number>(() => Number(amount.value))

const validationError = computed<string | null>(() => {
  if (!amount.value) return null
  const n = numericAmount.value
  if (!Number.isFinite(n) || n <= 0) return t('donate.errAmount')
  if (n <= DEFAULT_TX_FEE) return t('donate.errAmountTooSmall')
  if (balance.value !== null && n > balance.value) return t('donate.errInsufficient')
  return null
})

const canSend = computed<boolean>(
  () =>
    !sending.value &&
    !!donateStore.address &&
    numericAmount.value > DEFAULT_TX_FEE &&
    !validationError.value
)

/** Ленивая загрузка баланса при открытии (сумма доступных unspents). */
async function loadBalance(): Promise<void> {
  balance.value = null
  const address = authStore.getUserAddress
  if (!address) return
  try {
    let unspents = await getUnspents(address, 1, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    balance.value = unspents.reduce((sum, u) => sum + (u.amount || 0), 0)
  } catch (e) {
    console.warn('[Donate] balance load failed', e)
  }
}

watch(
  () => donateStore.isOpen,
  (isOpen) => {
    if (isOpen) {
      amount.value = ''
      void loadBalance()
    }
  }
)

function handleCancel(): void {
  if (sending.value) return
  donateStore.close()
}

async function onSend(): Promise<void> {
  if (!canSend.value) return
  sending.value = true
  try {
    const { donateToAuthor } = await import('@/blockchain/core/actions/donate-action')
    await donateToAuthor(donateStore.address, numericAmount.value)
    appToast.success({ message: t('donate.sentToast') })
    donateStore.close()
    // Празднуем донат всплеском монеток по центру экрана.
    if (typeof window !== 'undefined') {
      effectsStore.triggerCoins(window.innerWidth / 2, window.innerHeight / 3)
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('donate.errFailed') })
  } finally {
    sending.value = false
  }
}
</script>
