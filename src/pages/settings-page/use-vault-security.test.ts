// Секция «Безопасность кошелька» (P0-1): показ уровня защиты сида, включение
// и выключение passphrase с понятными тостами; ошибка не меняет показанный
// уровень и не оставляет кнопку в «занято». Сейф подменён — его крипта тестируется отдельно.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const vault = vi.hoisted(() => {
  class VaultMigrationIncompleteError extends Error {}
  return {
    level: 'device' as 'none' | 'device' | 'passphrase',
    status: 'unlocked' as string,
    enablePassphrase: vi.fn(),
    disablePassphrase: vi.fn(),
    VaultMigrationIncompleteError,
  }
})
vi.mock('@/blockchain/storage', () => ({
  getVaultLevel: () => vault.level,
  getVaultStatus: () => vault.status,
  enablePassphrase: vault.enablePassphrase,
  disablePassphrase: vault.disablePassphrase,
  VaultMigrationIncompleteError: vault.VaultMigrationIncompleteError,
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { useVaultSecurity } from './use-vault-security'

const PASS = 'correct horse battery staple'

describe('useVaultSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vault.level = 'device'
    vault.status = 'unlocked'
    // Как настоящий сейф: успешное переключение меняет уровень.
    vault.enablePassphrase.mockReset().mockImplementation(async () => {
      vault.level = 'passphrase'
    })
    vault.disablePassphrase.mockReset().mockImplementation(async () => {
      vault.level = 'device'
    })
  })

  it('показывает текущий уровень защиты и деградацию до fingerprint', () => {
    vault.level = 'none'
    vault.status = 'degraded-fingerprint'
    const s = useVaultSecurity()
    expect(s.level.value).toBe('none')
    expect(s.degraded.value).toBe(true)
    expect(s.busy.value).toBe(false)
  })

  it('refresh подхватывает изменения сейфа, сделанные снаружи', () => {
    const s = useVaultSecurity()
    expect(s.degraded.value).toBe(false)
    vault.level = 'passphrase'
    vault.status = 'degraded-fingerprint'
    s.refresh()
    expect(s.level.value).toBe('passphrase')
    expect(s.degraded.value).toBe(true)
  })

  describe('включение passphrase', () => {
    it('успех: уровень «passphrase», тост, пароль нигде не осел в localStorage', async () => {
      const s = useVaultSecurity()
      const pending = s.enable(PASS)
      expect(s.busy.value).toBe(true)

      expect(await pending).toBe(true)
      expect(vault.enablePassphrase).toHaveBeenCalledWith(PASS)
      expect(s.level.value).toBe('passphrase')
      expect(s.busy.value).toBe(false)
      expect(toast.success).toHaveBeenCalledWith({ message: 'vault.enabled' })
      expect(toast.error).not.toHaveBeenCalled()
      for (let i = 0; i < localStorage.length; i++) {
        expect(localStorage.getItem(localStorage.key(i)!)).not.toContain(PASS)
      }
    })

    it('не все секреты перешли под сейф → отказ с объяснением, уровень прежний', async () => {
      vault.enablePassphrase.mockRejectedValue(new vault.VaultMigrationIncompleteError('legacy'))
      const s = useVaultSecurity()

      expect(await s.enable(PASS)).toBe(false)
      expect(s.level.value).toBe('device')
      expect(s.busy.value).toBe(false)
      expect(toast.error).toHaveBeenCalledWith({ message: 'vault.migrationIncomplete' })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('прочая ошибка сейфа — показывается её текст', async () => {
      vault.enablePassphrase.mockRejectedValue(new Error('vault is locked'))
      const s = useVaultSecurity()

      expect(await s.enable(PASS)).toBe(false)
      expect(toast.error).toHaveBeenCalledWith({ message: 'vault is locked' })
      expect(s.level.value).toBe('device')
    })

    it('исключение не-Error — общий текст, кнопка не залипает', async () => {
      vault.enablePassphrase.mockRejectedValue('weird')
      const s = useVaultSecurity()

      expect(await s.enable(PASS)).toBe(false)
      expect(toast.error).toHaveBeenCalledWith({ message: 'vault.wrongPassphrase' })
      expect(s.busy.value).toBe(false)
    })
  })

  describe('выключение passphrase', () => {
    beforeEach(() => {
      vault.level = 'passphrase'
    })

    it('успех: возврат к device-уровню и тост', async () => {
      const s = useVaultSecurity()
      const pending = s.disable(PASS)
      expect(s.busy.value).toBe(true)

      expect(await pending).toBe(true)
      expect(vault.disablePassphrase).toHaveBeenCalledWith(PASS)
      expect(s.level.value).toBe('device')
      expect(s.busy.value).toBe(false)
      expect(toast.success).toHaveBeenCalledWith({ message: 'vault.disabled' })
    })

    it('неверный пароль: защита остаётся, тост «неверный пароль» без деталей ошибки', async () => {
      vault.disablePassphrase.mockRejectedValue(new Error('OperationError: decrypt failed'))
      const s = useVaultSecurity()

      expect(await s.disable('wrong')).toBe(false)
      expect(s.level.value).toBe('passphrase')
      expect(s.busy.value).toBe(false)
      expect(toast.error).toHaveBeenCalledWith({ message: 'vault.wrongPassphrase' })
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('запрос персистентного хранилища', () => {
    it('просит браузер не вытеснять хранилище', () => {
      const persist = vi.fn().mockResolvedValue(true)
      vi.stubGlobal('navigator', { storage: { persist } })
      try {
        useVaultSecurity().requestPersistentStorage()
        expect(persist).toHaveBeenCalledTimes(1)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('браузер отказал — отказ не всплывает необработанным', async () => {
      const unhandled = vi.fn()
      process.on('unhandledRejection', unhandled)
      vi.stubGlobal('navigator', {
        storage: { persist: () => Promise.reject(new Error('denied')) },
      })
      try {
        useVaultSecurity().requestPersistentStorage()
        await new Promise((r) => setTimeout(r, 10))
        expect(unhandled).not.toHaveBeenCalled()
      } finally {
        process.off('unhandledRejection', unhandled)
        vi.unstubAllGlobals()
      }
    })

    it('без Storage API или при его сбое — тихо ничего не делает', () => {
      vi.stubGlobal('navigator', {})
      try {
        expect(() => useVaultSecurity().requestPersistentStorage()).not.toThrow()
        vi.stubGlobal('navigator', {
          storage: {
            persist: () => {
              throw new Error('not allowed')
            },
          },
        })
        expect(() => useVaultSecurity().requestPersistentStorage()).not.toThrow()
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })
})
