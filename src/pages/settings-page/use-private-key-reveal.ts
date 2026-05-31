/**
 * Раскрытие приватного ключа / сид-фразы в Settings → «Приватный ключ».
 *
 * Стейт-машина:
 *   initial            → нажатие «Показать» → confirmVisible=true
 *   confirmVisible     → «Отмена» / «Да, показать»
 *   confirm → «Да»     → loading=true → revealed=true / error toast
 *   revealed           → «Скрыть» → возврат в initial
 *
 * Хранилище: пробуем найти зашифрованную мнемонику в `ACCOUNT_STORAGE_PREFIX+address`
 * (per-account), затем — в общем legacy-ключе. Дальше — `detectPrivateKeyFormat`
 * подсказывает, как интерпретировать строку (мнемоника/hex/WIF).
 *
 * CODE_AUDIT.md §1.
 */
import { ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores'
import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { detectPrivateKeyFormat, recoverKeyPair } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'

export interface PrivateKeyReveal {
  pkConfirmVisible: Ref<boolean>
  pkRevealed: Ref<boolean>
  pkLoading: Ref<boolean>
  pkMnemonic: Ref<string>
  pkPrivateKeyHex: Ref<string>
  pkShowConfirm: () => void
  pkCancelConfirm: () => void
  pkConfirmAndReveal: () => Promise<void>
  pkHide: () => void
  pkCopyMnemonic: () => Promise<void>
  pkCopyKey: () => Promise<void>
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback для контекстов без Clipboard API (старые WebView, file://).
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch (err) {
      console.error('Failed to copy:', err)
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

export function usePrivateKeyReveal(): PrivateKeyReveal {
  const authStore = useAuthStore()

  const pkConfirmVisible = ref(false)
  const pkMnemonic = ref('')
  const pkPrivateKeyHex = ref('')
  const pkRevealed = ref(false)
  const pkLoading = ref(false)

  function pkShowConfirm(): void {
    pkConfirmVisible.value = true
  }

  function pkCancelConfirm(): void {
    pkConfirmVisible.value = false
  }

  async function pkConfirmAndReveal(): Promise<void> {
    pkConfirmVisible.value = false
    pkLoading.value = true

    try {
      const address = authStore.getUserAddress
      if (!address) throw new Error(t('accountMsg.noActiveAccount'))

      const { loadEncryptedData, loadEncryptedMnemonic } = await import('@/blockchain/storage')

      const mnemonicResult = loadEncryptedData({
        persistent: true,
        storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
      })

      const rawData =
        mnemonicResult.success && mnemonicResult.data
          ? mnemonicResult.data
          : (() => {
              const generalResult = loadEncryptedMnemonic()
              if (generalResult.success && generalResult.data) return generalResult.data
              return null
            })()

      if (!rawData || !rawData.trim()) {
        throw new Error(t('accountMsg.noSavedSeedOrKey'))
      }

      const trimmed = rawData.trim()
      const format = detectPrivateKeyFormat(trimmed)
      if (format === 'mnemonic') {
        pkMnemonic.value = trimmed
        // Derive hex из мнемоники, чтобы пользователь видел оба формата.
        try {
          const { keyPair } = recoverKeyPair(trimmed)
          pkPrivateKeyHex.value = keyPair?.privateKey
            ? Buffer.isBuffer(keyPair.privateKey)
              ? keyPair.privateKey.toString('hex')
              : String(keyPair.privateKey)
            : ''
        } catch {
          pkPrivateKeyHex.value = ''
        }
      } else if (format === 'hex') {
        pkMnemonic.value = ''
        pkPrivateKeyHex.value = trimmed
      } else if (format === 'wif') {
        try {
          const { keyPair } = recoverKeyPair(trimmed)
          pkMnemonic.value = ''
          pkPrivateKeyHex.value = keyPair?.privateKey
            ? Buffer.isBuffer(keyPair.privateKey)
              ? keyPair.privateKey.toString('hex')
              : String(keyPair.privateKey)
            : ''
        } catch {
          throw new Error(t('accountMsg.keyReadFailed'))
        }
      } else {
        throw new Error(t('accountMsg.unknownDataFormat'))
      }

      pkRevealed.value = true
    } catch (error) {
      console.error('Failed to load private key:', error)
      appToast.error({
        message: error instanceof Error ? error.message : t('accountMsg.keyLoadFailed'),
      })
    } finally {
      pkLoading.value = false
    }
  }

  function pkHide(): void {
    pkRevealed.value = false
    pkMnemonic.value = ''
    pkPrivateKeyHex.value = ''
    pkConfirmVisible.value = false
  }

  async function pkCopyMnemonic(): Promise<void> {
    if (!pkMnemonic.value) return
    if (await copyToClipboard(pkMnemonic.value)) {
      appToast.success({ message: t('accountMsg.seedCopied') })
    }
  }

  async function pkCopyKey(): Promise<void> {
    if (!pkPrivateKeyHex.value) return
    if (await copyToClipboard(pkPrivateKeyHex.value)) {
      appToast.success({ message: t('accountMsg.privateKeyCopied') })
    }
  }

  return {
    pkConfirmVisible,
    pkRevealed,
    pkLoading,
    pkMnemonic,
    pkPrivateKeyHex,
    pkShowConfirm,
    pkCancelConfirm,
    pkConfirmAndReveal,
    pkHide,
    pkCopyMnemonic,
    pkCopyKey,
  }
}
