import { defineComponent, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/blockchain'
import { getAdditionalWalletAddressesList } from '@/blockchain'
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

export default defineComponent({
  name: 'WalletTransfer',
  components: {
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
  },
  setup() {
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
    /** Логин (имя аккаунта), когда получатель выбран из поиска; при ручном изменении адреса сбрасывается */
    const receiverLogin = ref<string | null>(null)
    const searchResults = ref<Array<{ address: string; name?: string }>>([])
    const searchLoading = ref(false)
    const showSearchDropdown = ref(false)
    const receiverAddressValidationError = ref<string | null>(null)
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

    const currentAddress = computed(() => authStore.getUserAddress)
    const additionalAddresses = computed(() => {
      const cur = currentAddress.value
      return cur ? getAdditionalWalletAddressesList(cur) : []
    })

    const receiveAddressOptions = computed(() => {
      const hasMain = !!currentAddress.value
      const hasAdditional = additionalAddresses.value.length > 0
      return [
        ...(hasMain ? [{ value: 'main' as const, label: 'Основной кошелёк' }] : []),
        ...(hasAdditional
          ? [{ value: 'additional' as const, label: 'Дополнительный кошелёк' }]
          : []),
      ]
    })

    const selectedReceiveAddress = computed(() => {
      if (receiveTarget.value === 'main') return currentAddress.value ?? ''
      const add = additionalAddresses.value
      return add.length > 0 ? add[0] : ''
    })

    const canSend = computed(() => {
      const addr = (receiverAddress.value || '').trim()
      const num = Number(amount.value)
      if (addr.length === 0 || num <= 0 || !currentAddress.value || !authStore.getKeyPair)
        return false
      if (receiverAddressValidationError.value) return false
      if (feemode.value === 'include' && num <= DEFAULT_TX_FEE) return false
      return true
    })

    async function searchUsers(query: string) {
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
            .filter((u: any) => u && (u.address || u.addr))
            .map((u: any) => ({
              address: u.address || u.addr,
              name: u.name ?? u.username ?? u.address,
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

    function onSearchInput() {
      const q = (receiverSearchQuery.value || '').trim()
      receiverAddressValidationError.value = null
      if (receiverLogin.value) {
        receiverLogin.value = null
      }
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

    function selectReceiver(user: { address: string; name?: string }) {
      receiverAddress.value = user.address
      receiverLogin.value = user.name ?? null
      receiverSearchQuery.value = user.address
      receiverAddressValidationError.value = null
      showSearchDropdown.value = false
      searchResults.value = []
    }

    function clearReceiverLink() {
      receiverAddress.value = ''
      receiverLogin.value = null
      receiverSearchQuery.value = ''
      searchResults.value = []
      showSearchDropdown.value = false
      receiverAddressValidationError.value = null
    }

    function onReceiverBlur() {
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

    function copyAddress() {
      const addr = selectedReceiveAddress.value
      if (!addr) return
      navigator.clipboard.writeText(addr).then(() => {
        copied.value = true
        setTimeout(() => {
          copied.value = false
        }, 2000)
      })
    }

    async function doSend() {
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
        // exclude = отправитель платит: нужна сумма + комиссия; include = получатель платит: комиссия вычитается из суммы
        const receiverAmount =
          feemode.value === 'include' ? Math.max(0, num - DEFAULT_TX_FEE) : num
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

    return {
      mode,
      receiveTarget,
      showReceiveAddress,
      receiverAddress,
      receiverSearchQuery,
      receiverLogin,
      searchResults,
      searchLoading,
      showSearchDropdown,
      clearReceiverLink,
      receiverAddressValidationError,
      onReceiverBlur,
      amount,
      message,
      feemode,
      error,
      success,
      sending,
      copied,
      currentAddress,
      receiveAddressOptions,
      selectedReceiveAddress,
      canSend,
      onSearchInput,
      selectReceiver,
      copyAddress,
      doSend,
    }
  },
})
