<template>
  <SC_TransferWidget>
    <SC_TransferSwitch>
      <SC_TransferSwitchBtn type="button" :active="mode === 'send'" @click="mode = 'send'">
        Отправка
      </SC_TransferSwitchBtn>
      <SC_TransferSwitchBtn type="button" :active="mode === 'receive'" @click="mode = 'receive'">
        Получение
      </SC_TransferSwitchBtn>
    </SC_TransferSwitch>

    <SC_TransferBody>
      <!-- Отправка -->
      <template v-if="mode === 'send'">
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-receiver">
            Получатель (имя или адрес)
          </SC_TransferLabel>
          <SC_TransferSearchWrap>
            <SC_TransferInput
              id="wallet-transfer-receiver"
              v-model="receiverSearchQuery"
              type="text"
              placeholder="Введите имя аккаунта или адрес (P / Z)"
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
          <div
            v-else-if="searchLoading"
            style="font-size: 12px; color: var(--color-gray-120); margin-top: 4px"
          >
            Поиск…
          </div>
          <SC_TransferLoginChip v-else-if="receiverLogin">
            <SC_TransferLoginChipText>Логин: {{ receiverLogin }}</SC_TransferLoginChipText>
            <SC_TransferLoginChipRemove
              type="button"
              aria-label="Удалить"
              @click="clearReceiverLink"
            >
              ×
            </SC_TransferLoginChipRemove>
          </SC_TransferLoginChip>
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-amount">Сумма (PKOIN)</SC_TransferLabel>
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
            Сообщение (необязательно)
          </SC_TransferLabel>
          <SC_TransferTextarea
            id="wallet-transfer-message"
            v-model="message"
            placeholder="Для чего эта транзакция?"
            maxlength="80"
          />
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel for="wallet-transfer-feemode">Комиссия</SC_TransferLabel>
          <SC_TransferSelect id="wallet-transfer-feemode" v-model="feemode">
            <option value="include">Получатель платит</option>
            <option value="exclude">Отправитель платит</option>
          </SC_TransferSelect>
        </SC_TransferField>
        <SC_TransferSubmit type="button" :disabled="!canSend || sending" @click="doSend">
          {{ sending ? 'Отправка...' : 'Рассчитать комиссию и отправить' }}
        </SC_TransferSubmit>
      </template>

      <!-- Получение -->
      <template v-else>
        <SC_TransferField v-if="receiveAddressOptions.length > 1">
          <SC_TransferLabel for="wallet-transfer-receive-target"> Получить на </SC_TransferLabel>
          <SC_TransferSelect id="wallet-transfer-receive-target" v-model="receiveTarget">
            <option v-for="opt in receiveAddressOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </SC_TransferSelect>
        </SC_TransferField>
        <template v-else-if="receiveAddressOptions.length === 1">
          <SC_TransferField>
            <SC_TransferLabel>Получить на</SC_TransferLabel>
            <div>{{ receiveAddressOptions[0]?.label }}</div>
          </SC_TransferField>
        </template>

        <SC_TransferField v-if="!showReceiveAddress && selectedReceiveAddress">
          <SC_TransferSubmit type="button" @click="showReceiveAddress = true">
            Показать адрес для получения
          </SC_TransferSubmit>
        </SC_TransferField>

        <template v-if="showReceiveAddress && selectedReceiveAddress">
          <SC_TransferField>
            <SC_TransferLabel>Адрес для получения PKOIN</SC_TransferLabel>
            <SC_TransferRow>
              <SC_TransferAddress>{{ selectedReceiveAddress }}</SC_TransferAddress>
              <SC_TransferCopyBtn type="button" @click="copyAddress">
                {{ copied ? 'Скопировано' : 'Скопировать' }}
              </SC_TransferCopyBtn>
            </SC_TransferRow>
          </SC_TransferField>
        </template>

        <div v-else-if="!currentAddress" style="color: var(--color-gray-120); font-size: 14px">
          Войдите в аккаунт, чтобы получить адрес.
        </div>
      </template>

      <SC_TransferError v-if="error">{{ error }}</SC_TransferError>
      <SC_TransferSuccess v-else-if="success">{{ success }}</SC_TransferSuccess>
    </SC_TransferBody>
  </SC_TransferWidget>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore, getAdditionalWalletAddressesList } from '@/blockchain'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { buildTransferTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { sendTransactionWithMessage } from '@/blockchain/core/transactions/transaction-sender'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { validateAddress } from '@/blockchain/core/addresses'
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
  SC_TransferAddress,
  SC_TransferCopyBtn,
  SC_TransferSubmit,
  SC_TransferError,
  SC_TransferFieldError,
  SC_TransferSuccess,
  SC_TransferSearchWrap,
  SC_TransferSearchDropdown,
  SC_TransferSearchItem,
  SC_TransferLoginChip,
  SC_TransferLoginChipText,
  SC_TransferLoginChipRemove,
} from './wallet-transfer.styled'

interface SearchUser {
  address: string
  name?: string
}

const authStore = useAuthStore()

const mode = ref<'receive' | 'send'>('send')
const receiveTarget = ref<'main' | 'additional'>('main')
const showReceiveAddress = ref(false)
const receiverAddress = ref('')
const amount = ref<string>('')
const message = ref('')
const feemode = ref<'include' | 'exclude'>('include')
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const sending = ref(false)
const copied = ref(false)
const receiverSearchQuery = ref('')
/** Имя аккаунта (логин), когда получатель выбран из поиска;
 *  при ручном изменении адреса сбрасывается. */
const receiverLogin = ref<string | null>(null)
const searchResults = ref<SearchUser[]>([])
const searchLoading = ref(false)
const showSearchDropdown = ref(false)
const receiverAddressValidationError = ref<string | null>(null)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const currentAddress = computed(() => authStore.getUserAddress)
const additionalAddresses = computed<string[]>(() => {
  const cur = currentAddress.value
  return cur ? getAdditionalWalletAddressesList(cur) : []
})

const receiveAddressOptions = computed(() => {
  const hasMain = !!currentAddress.value
  const hasAdditional = additionalAddresses.value.length > 0
  return [
    ...(hasMain ? [{ value: 'main' as const, label: 'Основной кошелёк' }] : []),
    ...(hasAdditional ? [{ value: 'additional' as const, label: 'Дополнительный кошелёк' }] : []),
  ]
})

const selectedReceiveAddress = computed<string>(() => {
  if (receiveTarget.value === 'main') return currentAddress.value ?? ''
  const add = additionalAddresses.value
  return add.length > 0 ? add[0] : ''
})

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

async function searchUsers(query: string): Promise<void> {
  const q = (query || '').trim()
  if (q.length < 2) {
    searchResults.value = []
    showSearchDropdown.value = false
    return
  }
  searchLoading.value = true
  searchResults.value = []
  try {
    const res = await getByPRC({
      method: rpcEndpoints.searchUsers,
      parameters: [q],
      options: { auth: false },
    })
    const data = Array.isArray(res) ? res : (res as { data?: unknown[] })?.data
    if (Array.isArray(data)) {
      searchResults.value = data
        .filter((u: unknown): u is Record<string, unknown> => {
          return !!u && typeof u === 'object' && ('address' in u || 'addr' in u)
        })
        .map((u) => ({
          address: (u.address || u.addr) as string,
          name: ((u.name ?? u.username ?? u.address) as string) || undefined,
        }))
      showSearchDropdown.value = searchResults.value.length > 0
    }
  } catch {
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

function looksLikeAddress(s: string): boolean {
  return /^[PZ][a-zA-Z0-9]{25,}$/.test((s || '').trim())
}

function onSearchInput(): void {
  const q = (receiverSearchQuery.value || '').trim()
  receiverAddressValidationError.value = null
  if (receiverLogin.value) receiverLogin.value = null
  if (looksLikeAddress(q)) {
    receiverAddress.value = q
    showSearchDropdown.value = false
    searchResults.value = []
    return
  }
  if (q.length === 0) {
    receiverAddress.value = ''
    receiverLogin.value = null
    return
  }
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (q.length < 2) {
    searchResults.value = []
    showSearchDropdown.value = false
    return
  }
  searchDebounceTimer = setTimeout(() => searchUsers(q), 300)
}

function selectReceiver(user: SearchUser): void {
  receiverAddress.value = user.address
  receiverLogin.value = user.name ?? null
  receiverSearchQuery.value = user.address
  receiverAddressValidationError.value = null
  showSearchDropdown.value = false
  searchResults.value = []
}

function clearReceiverLink(): void {
  receiverAddress.value = ''
  receiverLogin.value = null
  receiverSearchQuery.value = ''
  searchResults.value = []
  showSearchDropdown.value = false
  receiverAddressValidationError.value = null
}

function onReceiverBlur(): void {
  const q = (receiverSearchQuery.value || '').trim()
  receiverAddressValidationError.value = null
  if (!q) return
  if (!looksLikeAddress(q)) return
  const result = validateAddress(q)
  if (!result.isValid) {
    receiverAddressValidationError.value =
      result.error === 'Invalid address format'
        ? 'Некорректный формат адреса кошелька'
        : result.error || 'Некорректный адрес'
  }
}

function copyAddress(): void {
  const addr = selectedReceiveAddress.value
  if (!addr) return
  navigator.clipboard.writeText(addr).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  })
}

async function doSend(): Promise<void> {
  if (!canSend.value || sending.value) return
  const addr = (receiverAddress.value || '').trim()
  const num = Number(amount.value)
  if (!addr || num <= 0) return
  if (feemode.value === 'include' && num <= DEFAULT_TX_FEE) {
    error.value = 'Сумма должна быть больше комиссии (получатель платит)'
    return
  }

  const mainAddr = currentAddress.value
  const keyPair = authStore.getKeyPair
  if (!mainAddr || !keyPair) {
    error.value = 'Требуется авторизация'
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
      throw new Error('Недостаточно средств для перевода с учётом комиссии')
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
    success.value = `Перевод отправлен. TXID: ${txid.slice(0, 16)}…`
    receiverAddress.value = ''
    receiverLogin.value = null
    receiverSearchQuery.value = ''
    amount.value = ''
    message.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось отправить перевод'
  } finally {
    sending.value = false
  }
}

watch(mode, () => {
  error.value = null
  success.value = null
})

watch(
  receiveAddressOptions,
  (opts) => {
    if (opts.length === 1) receiveTarget.value = opts[0]!.value
  },
  { immediate: true }
)
</script>
