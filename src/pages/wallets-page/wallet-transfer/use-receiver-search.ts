// Поиск получателя по логину (debounce), выпадашка, чип выбранного логина и
// валидация введённого адреса. Владеет receiverAddress (его читает форма
// отправки). Вынесено из wallet-transfer.vue (см. LARGE_FILE_SPLIT_AUDIT.md).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { validateAddress } from '@/blockchain/core/addresses'
import { looksLikeAddress } from './helpers'
import { SEARCH_DEBOUNCE_MS } from './consts'

interface SearchUser {
  address: string
  name?: string
}

export function useReceiverSearch() {
  const { t } = useI18n()

  /** Итоговый адрес получателя (введён вручную или выбран из поиска). */
  const receiverAddress = ref('')
  const receiverSearchQuery = ref('')
  /** Имя аккаунта (логин), когда получатель выбран из поиска; при ручном
   *  изменении адреса сбрасывается. */
  const receiverLogin = ref<string | null>(null)
  const searchResults = ref<SearchUser[]>([])
  const searchLoading = ref(false)
  const showSearchDropdown = ref(false)
  const receiverAddressValidationError = ref<string | null>(null)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

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
    searchDebounceTimer = setTimeout(() => searchUsers(q), SEARCH_DEBOUNCE_MS)
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
          ? t('wallet.errorInvalidAddressFormat')
          : result.error || t('wallet.errorInvalidAddress')
    }
  }

  return {
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
  }
}
