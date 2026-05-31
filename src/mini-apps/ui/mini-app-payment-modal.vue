<template>
  <a-modal
    :open="isOpen && !!payment"
    :title="t('miniapps.paymentTitle')"
    :ok-text="sending ? t('miniapps.sending') : t('miniapps.confirm')"
    :cancel-text="t('miniapps.cancel')"
    :ok-button-props="{ disabled: sending }"
    :cancel-button-props="{ disabled: sending }"
    :closable="!sending"
    :mask-closable="false"
    centered
    @ok="onConfirm"
    @cancel="onCancel"
  >
    <SC_Wrap v-if="payment">
      <SC_AppRow v-if="appName">{{ t('miniapps.paymentRequestedBy', { name: appName }) }}</SC_AppRow>
      <SC_RecieverList>
        <SC_RecieverRow v-for="(r, idx) in payment.recievers" :key="idx">
          <SC_RecieverAddr>{{ r.address }}</SC_RecieverAddr>
          <SC_RecieverAmount>{{ formatAmount(r.amount) }} PKOIN</SC_RecieverAmount>
        </SC_RecieverRow>
      </SC_RecieverList>
      <SC_TotalRow>
        <span>{{ t('miniapps.paymentTotal') }}</span>
        <SC_TotalAmount>{{ formatAmount(total) }} PKOIN</SC_TotalAmount>
      </SC_TotalRow>
      <SC_FeeRow>
        {{ t('miniapps.paymentFee', { amount: formatAmount(DEFAULT_TX_FEE), mode: feemodeLabel }) }}
      </SC_FeeRow>
      <SC_MessageRow v-if="payment.message">{{
        t('miniapps.paymentMessage', { message: payment.message })
      }}</SC_MessageRow>
      <SC_Error v-if="error">{{ error }}</SC_Error>
    </SC_Wrap>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal as AModal } from 'ant-design-vue'
import { useAuthStore } from '@/blockchain'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { buildTransferTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { sendTransactionWithMessage } from '@/blockchain/core/transactions/transaction-sender'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import {
  isPaymentModalOpen,
  currentPaymentPayload,
  resolvePaymentModal,
} from './payment-modal-controller'
import {
  SC_Wrap,
  SC_AppRow,
  SC_RecieverList,
  SC_RecieverRow,
  SC_RecieverAddr,
  SC_RecieverAmount,
  SC_TotalRow,
  SC_TotalAmount,
  SC_FeeRow,
  SC_MessageRow,
  SC_Error,
} from './mini-app-payment-modal.styled'

// `a-modal` зарегистрирован глобально через ant-design-vue. Но в setup нам нужно
// именованное локальное имя, иначе TS-парсер ругается на «AModal is unused».
// Объявлено как const referenced ниже.
const _ = AModal
void _

defineProps<{ appName?: string }>()

const { t } = useI18n()
const authStore = useAuthStore()

const isOpen = computed(() => isPaymentModalOpen.value)
const payment = computed(() => currentPaymentPayload.value)
const total = computed(() => (payment.value?.recievers ?? []).reduce((s, r) => s + r.amount, 0))
const feemodeLabel = computed(() =>
  payment.value?.feemode === 'exclude'
    ? t('miniapps.feemodeSenderPays')
    : t('miniapps.feemodeReceiverPays')
)
const sending = ref(false)
const error = ref<string | null>(null)

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
}

async function onConfirm() {
  if (!payment.value || sending.value) return
  const mainAddr = authStore.getUserAddress
  const keyPair = authStore.getKeyPair
  if (!mainAddr || !keyPair) {
    error.value = t('miniapps.errorAuthRequired')
    return
  }

  const feemode = payment.value.feemode ?? 'include'
  const totalAmount = total.value
  const requiredAmount = feemode === 'exclude' ? totalAmount + DEFAULT_TX_FEE : totalAmount

  sending.value = true
  error.value = null
  try {
    const all = await getUnspents(mainAddr, 1, 9_999_999)
    const available = filterAvailableUnspents(all, false)
    const selected = selectBestUnspents(available, requiredAmount)
    if (!selected.length) {
      throw new Error(t('miniapps.errorInsufficientFunds'))
    }

    const built = await buildTransferTransaction({
      unspents: selected,
      fromAddress: mainAddr,
      sourceAddresses: [mainAddr],
      keyPair,
      outputs: payment.value.recievers.map((r) => ({
        address: r.address,
        amount: feemode === 'include' ? r.amount : r.amount,
      })),
      fee: DEFAULT_TX_FEE,
      message: payment.value.message ?? '',
      feemode,
    })

    const txid = await sendTransactionWithMessage({
      hex: built.hex,
      messageData: built.messageData,
      operationType: 'transaction',
    })
    resolvePaymentModal({ transaction: txid, completed: true })
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('miniapps.errorPaymentFailed')
  } finally {
    sending.value = false
  }
}

function onCancel() {
  if (sending.value) return
  resolvePaymentModal({ rejected: true, reason: 'user_cancelled' })
}
</script>
