// Вкладка «Получить»: выбор кошелька (основной/дополнительный), генерация QR на
// раскрытии и копирование адреса. Самодостаточно — вынесено из wallet-transfer.vue
// (см. LARGE_FILE_SPLIT_AUDIT.md).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, getAdditionalWalletAddressesList } from '@/blockchain'
import { generateQRCode } from '@/blockchain/utils/qr-code'
import { COPIED_RESET_TIMEOUT } from './consts'

export function useReceiveAddress() {
  const { t } = useI18n()
  const authStore = useAuthStore()

  const receiveTarget = ref<'main' | 'additional'>('main')
  const showReceiveAddress = ref(false)
  const copied = ref(false)
  const qrDataUrl = ref<string>('')

  const currentAddress = computed(() => authStore.getUserAddress)
  const additionalAddresses = computed<string[]>(() => {
    const cur = currentAddress.value
    return cur ? getAdditionalWalletAddressesList(cur) : []
  })

  const receiveAddressOptions = computed(() => {
    const hasMain = !!currentAddress.value
    const hasAdditional = additionalAddresses.value.length > 0
    return [
      ...(hasMain ? [{ value: 'main' as const, label: t('wallet.mainWallet') }] : []),
      ...(hasAdditional
        ? [{ value: 'additional' as const, label: t('wallet.additionalWallet') }]
        : []),
    ]
  })

  const selectedReceiveAddress = computed<string>(() => {
    if (receiveTarget.value === 'main') return currentAddress.value ?? ''
    const add = additionalAddresses.value
    return add.length > 0 ? add[0] : ''
  })

  // QR-код адреса на приём — генерируется, когда адрес раскрыт.
  watch(
    [showReceiveAddress, selectedReceiveAddress],
    async ([show, addr]) => {
      if (!show || !addr) {
        qrDataUrl.value = ''
        return
      }
      try {
        qrDataUrl.value = await generateQRCode(addr, { width: 220 })
      } catch {
        qrDataUrl.value = ''
      }
    },
    { immediate: true }
  )

  // Один доступный кошелёк — сразу выбираем его.
  watch(
    receiveAddressOptions,
    (opts) => {
      if (opts.length === 1) receiveTarget.value = opts[0]!.value
    },
    { immediate: true }
  )

  function copyAddress(): void {
    const addr = selectedReceiveAddress.value
    if (!addr) return
    navigator.clipboard.writeText(addr).then(() => {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, COPIED_RESET_TIMEOUT)
    })
  }

  return {
    receiveTarget,
    showReceiveAddress,
    copied,
    qrDataUrl,
    receiveAddressOptions,
    selectedReceiveAddress,
    copyAddress,
  }
}
