// Вкладка «Получить»: выбор кошелька (основной/дополнительный), генерация QR на
// раскрытии и копирование адреса. Самодостаточно — вынесено из wallet-transfer.vue
// (аудит крупных файлов 2026-08).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain'
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

  /**
   * Приём — только на основной кошелёк (решение Р2 по V6).
   *
   * Дополнительные кошельки — P2SH-P2WPKH, а ни один путь отправки в этом
   * клиенте не подписывает P2SH-вход (`addInput` без redeemScript). Монеты,
   * пришедшие на такой адрес, отсюда не потратить, поэтому предлагать его для
   * приёма нечестно. Баланс доп. кошельков виден во вкладке «Балансы», трата —
   * в roadmap.
   */
  const receiveAddressOptions = computed(() => {
    const hasMain = !!currentAddress.value
    return hasMain ? [{ value: 'main' as const, label: t('wallet.mainWallet') }] : []
  })

  const selectedReceiveAddress = computed<string>(() => currentAddress.value ?? '')

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
