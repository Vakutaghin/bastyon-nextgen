// Единый загрузчик сохранённого секрета текущего аккаунта (мнемоника / hex / WIF)
// для Settings: раскрытие ключа (use-private-key-reveal) и проверка бэкапа
// (use-backup-verification). Порядок: per-account `BST_ACCOUNT_<addr>`, затем
// legacy-ключ `BST_MNEMONIC`, но только если из него выводится этот же адрес:
// общий ключ хранит последний сохранённый сид, и без проверки «Приватный ключ»
// показывал бы сид другого аккаунта (как в свитчере до S10).

import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { detectPrivateKeyFormat } from '@/blockchain'
import { addressOfSecret } from '@/b-components/header/account-switcher/helpers/load-account-mnemonic'

export type AccountSecretFormat = 'mnemonic' | 'hex' | 'wif'

export interface AccountSecret {
  format: AccountSecretFormat
  /** Сырая строка как сохранена (мнемоника — слова через пробел). */
  raw: string
}

/**
 * @returns секрет или `null`, если для адреса ничего не сохранено.
 * @throws Error('unknown-format') если сохранённая строка не распознана.
 */
export async function loadAccountSecret(address: string): Promise<AccountSecret | null> {
  const { loadEncryptedData, loadEncryptedMnemonic } = await import('@/blockchain/storage')

  const perAccount = loadEncryptedData({
    persistent: true,
    storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
  })
  let raw = perAccount.success && perAccount.data ? perAccount.data : null
  if (!raw) {
    const legacy = loadEncryptedMnemonic()
    const shared = legacy.success && legacy.data ? legacy.data : null
    if (shared && addressOfSecret(shared) === address) raw = shared
  }
  if (!raw || !raw.trim()) return null

  const trimmed = raw.trim()
  const format = detectPrivateKeyFormat(trimmed)
  if (format !== 'mnemonic' && format !== 'hex' && format !== 'wif') {
    throw new Error('unknown-format')
  }
  return { format, raw: trimmed }
}
