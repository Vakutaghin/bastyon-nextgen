<template>
  <SC_TransferWidget>
    <SC_TransferSwitch>
      <SC_TransferSwitchBtn type="button" :active="mode === 'send'" @click="mode = 'send'">
        {{ t('wallet.send') }}
      </SC_TransferSwitchBtn>
      <SC_TransferSwitchBtn type="button" :active="mode === 'receive'" @click="mode = 'receive'">
        {{ t('wallet.receive') }}
      </SC_TransferSwitchBtn>
    </SC_TransferSwitch>

    <SC_TransferBody>
      <!-- Отправка -->
      <template v-if="mode === 'send'">
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-receiver">
            {{ t('wallet.receiverLabel') }}
          </SC_TransferLabel>
          <SC_TransferSearchWrap>
            <SC_TransferInput
              id="wallet-transfer-receiver"
              v-model="receiverSearchQuery"
              type="text"
              :placeholder="t('wallet.receiverPlaceholder')"
              autocomplete="off"
              @input="onSearchInput"
              @blur="onReceiverBlur"
            />
            <SC_TransferSearchDropdown v-if="showSearchDropdown && searchResults.length">
              <SC_TransferSearchItem
                v-for="user in searchResults"
                :key="user.address"
                type="button"
                @click="selectReceiver(user)"
              >
                {{ user.name || user.address }}
              </SC_TransferSearchItem>
            </SC_TransferSearchDropdown>
          </SC_TransferSearchWrap>
          <SC_TransferFieldError v-if="receiverAddressValidationError">
            {{ receiverAddressValidationError }}
          </SC_TransferFieldError>
          <SC_TransferSearchingHint v-else-if="searchLoading">
            {{ t('wallet.searching') }}
          </SC_TransferSearchingHint>
          <SC_TransferLoginChip v-else-if="receiverLogin">
            <SC_TransferLoginChipText>{{
              t('wallet.login', { login: receiverLogin })
            }}</SC_TransferLoginChipText>
            <SC_TransferLoginChipRemove
              type="button"
              :aria-label="t('wallet.remove')"
              @click="clearReceiverLink"
            >
              ×
            </SC_TransferLoginChipRemove>
          </SC_TransferLoginChip>
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-amount">{{
            t('wallet.amountLabel')
          }}</SC_TransferLabel>
          <SC_TransferInput
            id="wallet-transfer-amount"
            v-model="amount"
            type="number"
            step="0.00000001"
            min="0"
            placeholder="0.00"
          />
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-message">
            {{ t('wallet.messageLabel') }}
          </SC_TransferLabel>
          <SC_TransferTextarea
            id="wallet-transfer-message"
            v-model="message"
            :placeholder="t('wallet.messagePlaceholder')"
            maxlength="80"
          />
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-feemode">{{
            t('wallet.feeLabel')
          }}</SC_TransferLabel>
          <SC_TransferSelect id="wallet-transfer-feemode" v-model="feemode">
            <option value="include">{{ t('wallet.feeReceiverPays') }}</option>
            <option value="exclude">{{ t('wallet.feeSenderPays') }}</option>
          </SC_TransferSelect>
        </SC_TransferField>
        <SC_TransferSubmit type="button" :disabled="!canSend || sending" @click="doSend">
          {{ sending ? t('wallet.sending') : t('wallet.calcAndSend') }}
        </SC_TransferSubmit>
      </template>

      <!-- Получение -->
      <template v-else>
        <SC_TransferField v-if="receiveAddressOptions.length > 1">
          <SC_TransferLabel for="wallet-transfer-receive-target">
            {{ t('wallet.receiveTo') }}
          </SC_TransferLabel>
          <SC_TransferSelect id="wallet-transfer-receive-target" v-model="receiveTarget">
            <option v-for="opt in receiveAddressOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </SC_TransferSelect>
        </SC_TransferField>
        <template v-else-if="receiveAddressOptions.length === 1">
          <SC_TransferField>
            <SC_TransferLabel>{{ t('wallet.receiveTo') }}</SC_TransferLabel>
            <div>{{ receiveAddressOptions[0]?.label }}</div>
          </SC_TransferField>
        </template>

        <SC_TransferField v-if="!showReceiveAddress && selectedReceiveAddress">
          <SC_TransferSubmit type="button" @click="showReceiveAddress = true">
            {{ t('wallet.showReceiveAddress') }}
          </SC_TransferSubmit>
        </SC_TransferField>

        <template v-if="showReceiveAddress && selectedReceiveAddress">
          <SC_TransferField>
            <SC_TransferLabel>{{ t('wallet.receiveAddressLabel') }}</SC_TransferLabel>
            <SC_QrWrap v-if="qrDataUrl">
              <img :src="qrDataUrl" :alt="t('wallet.receiveQrAlt')" />
            </SC_QrWrap>
            <SC_TransferRow>
              <SC_TransferAddress>{{ selectedReceiveAddress }}</SC_TransferAddress>
              <SC_TransferCopyBtn type="button" @click="copyAddress">
                {{ copied ? t('wallet.copied') : t('wallet.copy') }}
              </SC_TransferCopyBtn>
            </SC_TransferRow>
          </SC_TransferField>
        </template>

        <SC_TransferLoginRequired v-else-if="!currentAddress">
          {{ t('wallet.loginToGetAddress') }}
        </SC_TransferLoginRequired>
      </template>

      <SC_TransferError v-if="error">{{ error }}</SC_TransferError>
      <SC_TransferSuccess v-else-if="success">{{ success }}</SC_TransferSuccess>
    </SC_TransferBody>
  </SC_TransferWidget>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { buildTransferTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { sendTransactionWithMessage } from '@/blockchain/core/transactions/transaction-sender'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { useReceiveAddress } from './use-receive-address'
import { useReceiverSearch } from './use-receiver-search'
import {
  SC_TransferWidget,
  SC_TransferSwitch,
  SC_TransferSwitchBtn,
  SC_TransferBody,
  SC_TransferField,
  SC_TransferLabel,
  SC_TransferInput,
  SC_TransferTextarea,
  SC_TransferSelect,
  SC_TransferRow,
  SC_QrWrap,
  SC_TransferAddress,
  SC_TransferCopyBtn,
  SC_TransferSubmit,
  SC_TransferError,
  SC_TransferFieldError,
  SC_TransferSuccess,
  SC_TransferSearchingHint,
  SC_TransferLoginRequired,
  SC_TransferSearchWrap,
  SC_TransferSearchDropdown,
  SC_TransferSearchItem,
  SC_TransferLoginChip,
  SC_TransferLoginChipText,
  SC_TransferLoginChipRemove,
} from './wallet-transfer.styled'

const { t } = useI18n()
const authStore = useAuthStore()

const mode = ref<'receive' | 'send'>('send')
const amount = ref<string>('')
const message = ref('')
const feemode = ref<'include' | 'exclude'>('include')
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const sending = ref(false)

const currentAddress = computed(() => authStore.getUserAddress)

// Вкладка «Получить» (кошелёк/QR/копирование) и поиск получателя — в composables.
const {
  receiveTarget,
  showReceiveAddress,
  copied,
  qrDataUrl,
  receiveAddressOptions,
  selectedReceiveAddress,
  copyAddress,
} = useReceiveAddress()

const {
  receiverAddress,
  receiverSearchQuery,
  receiverLogin,
  searchResults,
  searchLoading,
  showSearchDropdown,
  receiverAddressValidationError,
  onSearchInput,
  selectReceiver,
  clearReceiverLink,
  onReceiverBlur,
} = useReceiverSearch()

const canSend = computed<boolean>(() => {
  const addr = (receiverAddress.value || '').trim()
  const num = Number(amount.value)
  if (addr.length === 0 || num <= 0 || !currentAddress.value || !authStore.getKeyPair) {
    return false
  }
  if (receiverAddressValidationError.value) return false
  if (feemode.value === 'include' && num <= DEFAULT_TX_FEE) return false
  return true
})


async function doSend(): Promise<void> {
  if (!canSend.value || sending.value) return
  const addr = (receiverAddress.value || '').trim()
  const num = Number(amount.value)
  if (!addr || num <= 0) return
  if (feemode.value === 'include' && num <= DEFAULT_TX_FEE) {
    error.value = t('wallet.errorAmountLessThanFee')
    return
  }

  const mainAddr = currentAddress.value
  const keyPair = authStore.getKeyPair
  if (!mainAddr || !keyPair) {
    error.value = t('wallet.errorAuthRequired')
    return
  }

  error.value = null
  success.value = null
  sending.value = true

  try {
    let unspents = await getUnspents(mainAddr, 1, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    // include = получатель платит: комиссия вычитается из суммы перевода.
    // exclude = отправитель платит: ищем (сумма + комиссия) в UTXO.
    const receiverAmount = feemode.value === 'include' ? Math.max(0, num - DEFAULT_TX_FEE) : num
    const requiredAmount = feemode.value === 'exclude' ? num + DEFAULT_TX_FEE : num
    const selected = selectBestUnspents(unspents, requiredAmount)
    if (!selected.length) {
      throw new Error(t('wallet.errorInsufficientFunds'))
    }

    const built = await buildTransferTransaction({
      unspents: selected,
      fromAddress: mainAddr,
      sourceAddresses: [mainAddr],
      keyPair,
      outputs: [{ address: addr, amount: receiverAmount }],
      fee: DEFAULT_TX_FEE,
      message: (message.value || '').trim(),
      feemode: feemode.value,
    })

    const txid = await sendTransactionWithMessage({
      hex: built.hex,
      messageData: built.messageData,
      operationType: 'transaction',
    })
    success.value = t('wallet.transferSent', { txid: txid.slice(0, 16) })
    clearReceiverLink()
    amount.value = ''
    message.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('wallet.errorTransferFailed')
  } finally {
    sending.value = false
  }
}

watch(mode, () => {
  error.value = null
  success.value = null
})
</script>
