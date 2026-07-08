// Логика секции «Безопасность кошелька» в настройках (P0-1): показ текущего
// уровня защиты сида at-rest и включение/выключение passphrase-режима.

import { ref } from 'vue'
import {
  getVaultLevel,
  getVaultStatus,
  enablePassphrase,
  disablePassphrase,
  type VaultLevel,
} from '@/blockchain/storage'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'

export function useVaultSecurity() {
  const level = ref<VaultLevel>(getVaultLevel())
  const degraded = ref(getVaultStatus() === 'degraded-fingerprint')
  const busy = ref(false)

  const refresh = (): void => {
    level.value = getVaultLevel()
    degraded.value = getVaultStatus() === 'degraded-fingerprint'
  }

  /** Просим браузер сделать хранилище персистентным (снижает риск вытеснения device-ключа). */
  const requestPersistentStorage = (): void => {
    try {
      void navigator.storage?.persist?.()
    } catch {
      /* не поддерживается — не критично */
    }
  }

  const enable = async (passphrase: string): Promise<boolean> => {
    busy.value = true
    try {
      await enablePassphrase(passphrase)
      refresh()
      appToast.success({ message: t('vault.enabled') })
      return true
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('vault.wrongPassphrase') })
      return false
    } finally {
      busy.value = false
    }
  }

  const disable = async (currentPassphrase: string): Promise<boolean> => {
    busy.value = true
    try {
      await disablePassphrase(currentPassphrase)
      refresh()
      appToast.success({ message: t('vault.disabled') })
      return true
    } catch {
      appToast.error({ message: t('vault.wrongPassphrase') })
      return false
    } finally {
      busy.value = false
    }
  }

  return { level, degraded, busy, refresh, requestPersistentStorage, enable, disable }
}
