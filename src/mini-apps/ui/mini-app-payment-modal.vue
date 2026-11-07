<template>
  <a-modal
    :open="isOpen && !!payment"
    :title="t('miniapps.paymentTitle')"
    :ok-text="sending ? t('miniapps.sending') : t('miniapps.confirm')"
    :cancel-text="t('miniapps.cancel')"
    :ok-button-props="{ disabled: sending || blocked }"
    :cancel-button-props="{ disabled: sending }"
    :closable="!sending"
    :mask-closable="false"
    centered
    @ok="onConfirm"
    @cancel="onCancel"
  >
    <SC_Wrap v-if="payment">
      <SC_AppRow v-if="appName">{{
        t('miniapps.paymentRequestedBy', { name: appName })
      }}</SC_AppRow>
      <!-- Платёж по ссылке магазина (ext): магазин, описание, товары. -->
      <template v-if="details">
        <SC_StoreRow v-if="details.store">
          {{ details.store.name
          }}<template v-if="details.store.site"> · {{ details.store.site }}</template>
        </SC_StoreRow>
        <SC_MessageRow v-if="details.description">{{ details.description }}</SC_MessageRow>
        <SC_RecieverList v-if="details.items?.length">
          <SC_RecieverRow v-for="(item, idx) in details.items" :key="idx">
            <span>{{
              item.count > 1
                ? t('miniapps.extItemCount', { name: item.name, count: item.count })
                : item.name
            }}</span>
            <SC_RecieverAmount>{{ formatAmount(item.value * item.count) }} PKOIN</SC_RecieverAmount>
          </SC_RecieverRow>
        </SC_RecieverList>
      </template>
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
        {{ t('miniapps.paymentFee', { amount: formatAmount(estimatedFee), mode: feemodeLabel }) }}
      </SC_FeeRow>
      <SC_MessageRow v-if="message">{{ t('miniapps.paymentMessage', { message }) }}</SC_MessageRow>
      <template v-if="details">
        <SC_FeeRow v-if="details.expiresAt" :class="{ expired }">{{
          expired ? t('miniapps.extExpired') : t('miniapps.extExpires', { time: expiresText })
        }}</SC_FeeRow>
        <Input
          v-if="details.askEmail"
          v-model:value="email"
          type="email"
          autocomplete="email"
          :disabled="sending"
          :placeholder="t('miniapps.extEmail')"
          :aria-label="t('miniapps.extEmail')"
        />
        <Input
          v-if="details.askPhone"
          v-model:value="phone"
          type="tel"
          autocomplete="tel"
          :disabled="sending"
          :placeholder="t('miniapps.extPhone')"
          :aria-label="t('miniapps.extPhone')"
        />
        <SC_FeeRow v-if="details.callbackHost">{{
          details.sharesAccount
            ? t('miniapps.extCallbackAccount', { host: details.callbackHost })
            : t('miniapps.extCallback', { host: details.callbackHost })
        }}</SC_FeeRow>
      </template>
      <SC_Error v-if="error">{{ error }}</SC_Error>
    </SC_Wrap>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input, Modal as AModal } from 'ant-design-vue'
import { bcp47 } from '@/i18n'
import { useAuthStore } from '@/blockchain'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { buildTransferTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { splitFeeAcrossReceivers } from '@/blockchain/core/transactions/split-fee'
import { sendTransactionWithMessage } from '@/blockchain/core/transactions/transaction-sender'
import { transferFee } from '@/blockchain/core/transactions/transfer-fee'
import { utf8Length } from '@/helpers/common/op-return'
import { fitOpReturnText } from '@/helpers/common/op-return'
import { playSound } from '@/services/app-sounds'
import {
  isPaymentModalOpen,
  currentPaymentPayload,
  currentPaymentAppName,
  currentPaymentDetails,
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
  SC_StoreRow,
} from './mini-app-payment-modal.styled'

// `a-modal` зарегистрирован глобально через ant-design-vue. Но в setup нам нужно
// именованное локальное имя, иначе TS-парсер ругается на «AModal is unused».
// Объявлено как const referenced ниже.
const _ = AModal
void _

const { t, locale } = useI18n()
const authStore = useAuthStore()

const isOpen = computed(() => isPaymentModalOpen.value)
// Имя приходит из контроллера вместе с payload — prop никто не передавал (N22).
const appName = computed(() => currentPaymentAppName.value)
const payment = computed(() => currentPaymentPayload.value)
/**
 * Сообщение платежа пишется в OP_RETURN, а нода пропускает там 80 байт.
 * Приложение вправе прислать до 256 символов — показываем и отправляем то,
 * что поместится: иначе платёж отвергла бы нода.
 */
const message = computed(() => fitOpReturnText(payment.value?.message ?? ''))
const total = computed(() => (payment.value?.recievers ?? []).reduce((s, r) => s + r.amount, 0))
const feemodeLabel = computed(() =>
  payment.value?.feemode === 'exclude'
    ? t('miniapps.feemodeSenderPays')
    : t('miniapps.feemodeReceiverPays')
)
const sending = ref(false)
const error = ref<string | null>(null)

// ── Платёж по ссылке магазина ───────────────────────────────────────────
const details = computed(() => currentPaymentDetails.value)
const email = ref('')
const phone = ref('')
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null
const stopClock = (): void => {
  if (clock) clearInterval(clock)
  clock = null
}
// Срок ссылки проверяем каждую секунду, пока окно открыто.
watch(
  details,
  (d) => {
    stopClock()
    email.value = ''
    phone.value = ''
    now.value = Date.now()
    if (d?.expiresAt) clock = setInterval(() => (now.value = Date.now()), 1000)
  },
  { immediate: true }
)
onBeforeUnmount(stopClock)

const expired = computed(() => !!details.value?.expiresAt && now.value >= details.value.expiresAt)
const expiresText = computed(() =>
  details.value?.expiresAt
    ? new Intl.DateTimeFormat(bcp47(locale.value), {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(details.value.expiresAt)
    : ''
)
const emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const phoneOk = computed(() => phone.value.replace(/\D/g, '').length >= 5)
/** Платить нельзя: ссылка истекла или магазин ждёт контакт, а его нет. */
const blocked = computed(() => {
  const d = details.value
  if (!d) return false
  return expired.value || (!!d.askEmail && !emailOk.value) || (!!d.askPhone && !phoneOk.value)
})

/**
 * Комиссия, которую показываем до оплаты: по одному входу — столько платит
 * обычная покупка. Точную считаем перед сборкой, когда известны входы.
 * Один сатоши тут держать нельзя: сеть такой перевод отклоняет (-26).
 */
const estimatedFee = computed(() =>
  transferFee({
    inputs: 1,
    outputs: payment.value?.recievers.length ?? 1,
    messageBytes: utf8Length(message.value),
  })
)

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
}

async function onConfirm() {
  if (!payment.value || sending.value || blocked.value) return
  const mainAddr = authStore.getUserAddress
  const keyPair = authStore.getKeyPair
  if (!mainAddr || !keyPair) {
    error.value = t('miniapps.errorAuthRequired')
    return
  }

  const feemode = payment.value.feemode ?? 'include'
  const totalAmount = total.value
  const requiredAmount = feemode === 'exclude' ? totalAmount + estimatedFee.value : totalAmount

  sending.value = true
  error.value = null
  try {
    const all = await getUnspents(mainAddr, 1, 9_999_999)
    const available = filterAvailableUnspents(all, false)
    // Лок входов, как в контентных отправителях (P2-5): вторая оплата подряд не
    // подберёт те же UTXO, пока нода не увидела первую транзакцию.
    const selected = selectAndLockUnspents(available, requiredAmount)
    if (!selected.length) {
      throw new Error(t('miniapps.errorInsufficientFunds'))
    }

    // Комиссия считается от размера, а размер зависит от числа входов —
    // поэтому окончательную берём уже по выбранным входам.
    const fee = transferFee({
      inputs: selected.length,
      outputs: payment.value.recievers.length,
      messageBytes: utf8Length(message.value),
    })

    const built = await buildTransferTransaction({
      unspents: selected,
      fromAddress: mainAddr,
      sourceAddresses: [mainAddr],
      keyPair,
      outputs: splitFeeAcrossReceivers(payment.value.recievers, feemode, fee),
      fee,
      message: message.value,
      feemode,
    })

    const txid = await sendTransactionWithMessage({
      hex: built.hex,
      messageData: built.messageData,
      operationType: 'transaction',
      pending: {
        kind: 'payment',
        amount: totalAmount,
        ...(appName.value ? { title: appName.value } : {}),
      },
    })
    playSound('coin')
    const d = details.value
    const contacts =
      d?.askEmail || d?.askPhone
        ? {
            ...(d.askEmail ? { email: email.value.trim() } : {}),
            ...(d.askPhone ? { phone: phone.value.trim() } : {}),
          }
        : undefined
    resolvePaymentModal({ transaction: txid, completed: true, ...(contacts ? { contacts } : {}) })
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
