// Восстановление сессии на буте: сейф не разлочен → ничего не трогаем; подъём
// текущего аккаунта; legacy-fallback на BST_MNEMONIC; ошибки → error, а не вечный
// скелетон 'restoring'; ни один сбой не стирает аккаунты. Брошенная регистрация
// (V8) — основные кейсы в auth-store.test.ts, здесь — её сбойные ветки.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ACC_A = 'PAccountAaaaaaaaaaaaaaaaaaaaaaaaaa'
const ACC_B = 'PAccountBbbbbbbbbbbbbbbbbbbbbbbbbb'
/** Адрес, который мок keys-store выводит из legacy-ключа. */
const LEGACY_ADDR = 'PLegacyOwnerxxxxxxxxxxxxxxxxxxxxx'

const m = vi.hoisted(() => ({
  ensureVaultUnlocked: vi.fn(),
  finalizeMigration: vi.fn(),
  peekPendingRegistration: vi.fn(),
  clearPendingRegistration: vi.fn(),
  loadAccountsList: vi.fn(),
  loadEncryptedMnemonic: vi.fn(),
  clearAllUserData: vi.fn(),
  recoverKeyPair: vi.fn(),
  loadBip39Russian: vi.fn(),
  deriveAndSaveWalletAddresses: vi.fn(),
  ws: { connect: vi.fn(), close: vi.fn(), switchAccount: vi.fn() },
  recoverFromAccount: vi.fn(),
  removeAccount: vi.fn(),
  fetchUserState: vi.fn(),
  messenger: { logout: vi.fn(), initMatrix: vi.fn(), purgeAccountData: vi.fn() },
}))

// Граница с localStorage/сейфом — целиком подменена.
vi.mock('../../storage', () => ({
  ensureVaultUnlocked: m.ensureVaultUnlocked,
  finalizeMigration: m.finalizeMigration,
  peekPendingRegistration: m.peekPendingRegistration,
  clearPendingRegistration: m.clearPendingRegistration,
  loadAccountsList: m.loadAccountsList,
  loadEncryptedMnemonic: m.loadEncryptedMnemonic,
  clearAllUserData: m.clearAllUserData,
  // Нужны auth-store вне restore.
  hasStoredSession: () => false,
  saveWasLogged: vi.fn(),
  updateAccountName: vi.fn(),
  ensureInitialized: vi.fn(),
  destroyVault: vi.fn(),
  clearPendingRegistrationFor: vi.fn(),
  clearAccountScopedLocalData: vi.fn(),
}))
// Криптография ключей (bip39/bitcoinjs) — тяжёлая, не предмет теста.
vi.mock('../../core/keys', () => ({
  generateKeys: vi.fn(),
  recoverKeyPair: m.recoverKeyPair,
  loadBip39Russian: m.loadBip39Russian,
}))
vi.mock('../../wallet-addresses', () => ({
  deriveAndSaveWalletAddresses: m.deriveAndSaveWalletAddresses,
}))
vi.mock('../../ws', () => ({ wsService: m.ws }))
vi.mock('./account-scoped', () => ({ resetAccountScopedStores: vi.fn(async () => {}) }))
vi.mock('@/b-components/messenger/store', () => ({ useMessengerStore: () => m.messenger }))

// keys-store: настоящая pinia-форма, расшифровка аккаунта — под контролем теста.
vi.mock('../keys-store', async () => {
  const { defineStore } = await import('pinia')
  return {
    useKeysStore: defineStore('keys', {
      state: () => ({
        keyPair: null as unknown,
        address: null as string | null,
        accountsList: null as unknown,
      }),
      actions: {
        setKeyPair(kp: unknown) {
          this.keyPair = kp
          this.address = LEGACY_ADDR
        },
        clearKeys() {
          this.keyPair = null
          this.address = null
          this.accountsList = null
        },
        recoverFromAccount: m.recoverFromAccount,
        removeAccount: m.removeAccount,
      },
    }),
  }
})
vi.mock('../profile-store', async () => {
  const { defineStore } = await import('pinia')
  return {
    useProfileStore: defineStore('profile', {
      state: () => ({
        userProfile: null as unknown,
        userAvatarUrl: null as string | null,
        isFetchingUserState: false,
      }),
      actions: { fetchUserState: m.fetchUserState, clearProfile: vi.fn() },
    }),
  }
})

import { useAuthStore } from '../auth-store'

function fakeKeyPair(fill: number) {
  return {
    privateKey: Buffer.alloc(32, fill),
    publicKey: Buffer.alloc(33, fill),
    ecPair: {},
  }
}

function accountsList(current: string | null, ...addresses: string[]) {
  return {
    success: true,
    data: {
      accounts: addresses.map((address) => ({ address, encryptedMnemonic: 'enc', lastUsed: 1 })),
      currentAccount: current,
    },
  }
}

/** Как настоящий keys-store: успешная расшифровка кладёт ключи и адрес в стор. */
function accountDecrypts(kp = fakeKeyPair(1)) {
  m.recoverFromAccount.mockImplementation(async function (
    this: { keyPair: unknown; address: string | null },
    address: string
  ) {
    this.keyPair = kp
    this.address = address
    return { keyPair: kp, mnemonic: MNEMONIC }
  })
}

/** Старт приложения со следами сессии: UI уже показывает скелетон. */
async function boot() {
  const store = useAuthStore()
  store.authState = 'restoring'
  const ok = await store.restoreSession()
  return { store, ok }
}

function expectNothingWiped() {
  expect(m.clearAllUserData).not.toHaveBeenCalled()
  expect(m.removeAccount).not.toHaveBeenCalled()
  expect(m.clearPendingRegistration).not.toHaveBeenCalled()
}

describe('restoreSession — восстановление сессии на буте', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    m.ensureVaultUnlocked.mockReset().mockResolvedValue({ status: 'empty', level: 'none' })
    m.finalizeMigration.mockReset()
    m.peekPendingRegistration.mockReset().mockReturnValue(null)
    m.loadAccountsList.mockReset().mockReturnValue({ success: false })
    m.loadEncryptedMnemonic.mockReset().mockReturnValue({ success: false })
    m.recoverKeyPair.mockReset()
    m.loadBip39Russian.mockReset().mockResolvedValue(undefined)
    m.recoverFromAccount.mockReset().mockResolvedValue(null)
    m.removeAccount.mockReset().mockReturnValue(true)
    m.fetchUserState.mockReset().mockResolvedValue(null)
    m.messenger.initMatrix.mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('сейф не разлочен', () => {
    it.each(['needs-passphrase', 'storage-unavailable', 'needs-reset'] as const)(
      '%s — не входим, скелетон снимаем, аккаунты и брошенную регистрацию не трогаем',
      async (status) => {
        m.ensureVaultUnlocked.mockResolvedValue({ status, level: 'none' })
        // Есть и аккаунты, и брошенная регистрация — соблазн «почистить» велик.
        m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
        m.peekPendingRegistration.mockReturnValue({ address: ACC_B, step: 1, nickname: 'b' })
        m.loadEncryptedMnemonic.mockReturnValue({ success: true, data: MNEMONIC })

        const { store, ok } = await boot()

        expect(ok).toBe(false)
        expect(store.authState).toBe('unauthenticated')
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
        expect(store.isAuthenticated).toBe(false)
        expectNothingWiped()
        // Ни одной попытки расшифровать секреты под залоченным сейфом.
        expect(m.recoverFromAccount).not.toHaveBeenCalled()
        expect(m.loadEncryptedMnemonic).not.toHaveBeenCalled()
        expect(m.recoverKeyPair).not.toHaveBeenCalled()
        expect(m.ws.connect).not.toHaveBeenCalled()
      }
    )

    it('после «Позже» следующий вызов снова спрашивает сейф', async () => {
      m.ensureVaultUnlocked.mockResolvedValueOnce({ status: 'needs-passphrase', level: 'none' })
      const { store } = await boot()
      m.ensureVaultUnlocked.mockResolvedValueOnce({ status: 'unlocked', level: 'passphrase' })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      expect(await store.restoreSession()).toBe(true)
      expect(m.ensureVaultUnlocked).toHaveBeenCalledTimes(2)
      expect(store.address).toBe(ACC_A)
    })
  })

  describe('отложенная миграция сейфа', () => {
    it('после разлочки миграция добивается через 2.5 с и не задерживает вход', async () => {
      vi.useFakeTimers()
      m.ensureVaultUnlocked.mockResolvedValue({ status: 'unlocked', level: 'device' })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      const { store, ok } = await boot()
      expect(ok).toBe(true)
      expect(store.authState).toBe('authenticated')
      expect(m.finalizeMigration).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(2_500)
      expect(m.finalizeMigration).toHaveBeenCalledTimes(1)
    })

    it('сбой отложенной миграции не роняет поднятую сессию', async () => {
      vi.useFakeTimers()
      m.ensureVaultUnlocked.mockResolvedValue({ status: 'unlocked', level: 'device' })
      m.finalizeMigration.mockImplementation(() => {
        throw new Error('pbkdf2 failed')
      })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      const { store } = await boot()
      await vi.advanceTimersByTimeAsync(2_500)
      expect(m.finalizeMigration).toHaveBeenCalled()
      expect(store.isUserAuthenticated).toBe(true)
      expect(store.error).toBeNull()
    })

    it.each(['empty', 'degraded-fingerprint'] as const)(
      '%s — восстановление идёт, миграция не запускается',
      async (status) => {
        vi.useFakeTimers()
        m.ensureVaultUnlocked.mockResolvedValue({ status, level: 'none' })
        m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
        accountDecrypts()

        const { ok } = await boot()
        await vi.advanceTimersByTimeAsync(5_000)
        expect(ok).toBe(true)
        expect(m.finalizeMigration).not.toHaveBeenCalled()
      }
    )
  })

  describe('текущий аккаунт', () => {
    it('поднимается из списка: авторизован, профиль, WS и мессенджер запущены', async () => {
      const list = accountsList(ACC_A, ACC_B, ACC_A)
      m.loadAccountsList.mockReturnValue(list)
      const kp = fakeKeyPair(7)
      accountDecrypts(kp)

      const { store, ok } = await boot()

      expect(ok).toBe(true)
      expect(m.recoverFromAccount).toHaveBeenCalledWith(ACC_A)
      expect(store.isUserAuthenticated).toBe(true)
      expect(store.address).toBe(ACC_A)
      expect(store.keyPair).toEqual(kp)
      expect(store.accountsList).toEqual(list.data)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(m.fetchUserState).toHaveBeenCalledWith(ACC_A)
      expect(m.ws.connect).toHaveBeenCalledTimes(1)
      // Смена аккаунта, а не выход: кэши мессенджера не стираются, Matrix входит заново.
      // Мессенджер стартует в фоне (динамический импорт) — вход его не ждёт.
      await vi.waitFor(() => expect(m.messenger.initMatrix).toHaveBeenCalled())
      expect(m.messenger.logout).toHaveBeenCalledWith({ purge: false })
      // Legacy-путь не нужен.
      expect(m.loadEncryptedMnemonic).not.toHaveBeenCalled()
      expectNothingWiped()
    })

    it('Matrix не поднялся — сессия всё равно поднята', async () => {
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()
      m.messenger.initMatrix.mockRejectedValue(new Error('homeserver down'))

      const { store, ok } = await boot()
      await vi.waitFor(() => expect(m.messenger.initMatrix).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 0))

      expect(ok).toBe(true)
      expect(store.isUserAuthenticated).toBe(true)
      expect(store.error).toBeNull()
    })

    it('список есть, но текущий не выбран — расшифровка аккаунтов не запускается', async () => {
      m.loadAccountsList.mockReturnValue(accountsList(null, ACC_A))

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(m.recoverFromAccount).not.toHaveBeenCalled()
      expect(store.authState).toBe('unauthenticated')
      // Список аккаунтов всё равно показан (переключатель аккаунтов).
      expect(store.accountsList?.accounts).toHaveLength(1)
      expectNothingWiped()
    })
  })

  describe('legacy-fallback (общий BST_MNEMONIC)', () => {
    beforeEach(() => {
      m.loadEncryptedMnemonic.mockReturnValue({ success: true, data: MNEMONIC })
    })

    it('текущий аккаунт не расшифровался → вход по legacy-мнемонике', async () => {
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      m.recoverFromAccount.mockResolvedValue(null)
      const kp = fakeKeyPair(9)
      m.recoverKeyPair.mockReturnValue({ keyPair: kp, format: 'mnemonic' })

      const { store, ok } = await boot()

      expect(ok).toBe(true)
      expect(m.recoverFromAccount).toHaveBeenCalledWith(ACC_A)
      expect(m.recoverKeyPair).toHaveBeenCalledWith(MNEMONIC)
      expect(store.isUserAuthenticated).toBe(true)
      expect(store.address).toBe(LEGACY_ADDR)
      expect(store.keyPair).toEqual(kp)
      expect(m.deriveAndSaveWalletAddresses).toHaveBeenCalledWith(MNEMONIC, LEGACY_ADDR)
      expect(m.fetchUserState).toHaveBeenCalledWith(LEGACY_ADDR)
      expect(m.ws.connect).toHaveBeenCalledTimes(1)
      await vi.waitFor(() => expect(m.messenger.logout).toHaveBeenCalledWith({ purge: false }))
      expectNothingWiped()
    })

    it('списка аккаунтов нет (старая установка) — legacy-мнемоника поднимает сессию', async () => {
      m.recoverKeyPair.mockReturnValue({ keyPair: fakeKeyPair(3), format: 'mnemonic' })

      const { store, ok } = await boot()

      expect(ok).toBe(true)
      expect(m.recoverFromAccount).not.toHaveBeenCalled()
      expect(store.authState).toBe('authenticated')
    })

    it.each([
      ['отсутствует', { success: false }],
      ['пустая', { success: true, data: '' }],
    ])(
      'аккаунт не поднялся, legacy-мнемоника %s → «не авторизован», данные целы',
      async (_label, stored) => {
        m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
        m.loadEncryptedMnemonic.mockReturnValue(stored)

        const { store, ok } = await boot()

        expect(ok).toBe(false)
        expect(store.authState).toBe('unauthenticated')
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
        expect(m.recoverKeyPair).not.toHaveBeenCalled()
        expectNothingWiped()
      }
    )

    it('legacy-мнемоника не разбирается → ошибка, без входа и без стирания', async () => {
      m.recoverKeyPair.mockImplementation(() => {
        throw new Error('Invalid mnemonic checksum')
      })

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(store.authState).toBe('error')
      expect(store.error).toBe('Invalid mnemonic checksum')
      expect(store.isAuthenticated).toBe(false)
      expect(store.keyPair).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(m.ws.connect).not.toHaveBeenCalled()
      expectNothingWiped()
    })

    it('исключение не-Error при разборе → общий текст ошибки', async () => {
      m.recoverKeyPair.mockImplementation(() => {
        throw 'boom'
      })

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(store.error).toBe('Failed to recover key pair')
    })

    it.each([
      ['undefined', undefined],
      ['без keyPair', { format: 'unknown' }],
    ])('разбор вернул %s → ошибка invalid result, не вход', async (_label, result) => {
      m.recoverKeyPair.mockReturnValue(result)

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(store.authState).toBe('error')
      expect(store.error).toBe('Failed to recover key pair: invalid result')
      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(m.deriveAndSaveWalletAddresses).not.toHaveBeenCalled()
      expectNothingWiped()
    })
  })

  describe('непредвиденные сбои', () => {
    it.each([
      ['сейф', () => m.ensureVaultUnlocked.mockRejectedValue(new Error('vault exploded'))],
      ['словарь BIP39', () => m.loadBip39Russian.mockRejectedValue(new Error('vault exploded'))],
      [
        'расшифровка текущего аккаунта',
        () => {
          m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
          m.recoverFromAccount.mockRejectedValue(new Error('vault exploded'))
        },
      ],
    ])('сбой «%s» → состояние error с текстом, ничего не стёрто', async (_label, arrange) => {
      arrange()

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(store.authState).toBe('error')
      expect(store.error).toBe('vault exploded')
      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoading).toBe(false)
      expectNothingWiped()
    })

    it('исключение не-Error → «Failed to restore session»', async () => {
      m.ensureVaultUnlocked.mockRejectedValue('nope')

      const { store, ok } = await boot()

      expect(ok).toBe(false)
      expect(store.error).toBe('Failed to restore session')
      expect(store.authState).toBe('error')
    })
  })

  describe('брошенная регистрация: сбойные ветки', () => {
    it('сбой чтения отметки регистрации не мешает поднять сессию и ничего не стирает', async () => {
      m.peekPendingRegistration.mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON')
      })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      const { store, ok } = await boot()

      expect(ok).toBe(true)
      expect(store.address).toBe(ACC_A)
      expectNothingWiped()
    })

    it('сбой удаления брошенного аккаунта не превращается в стирание всех аккаунтов', async () => {
      m.peekPendingRegistration.mockReturnValue({ address: ACC_B, step: 1, nickname: 'b' })
      m.removeAccount.mockImplementation(() => {
        throw new Error('storage write failed')
      })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A, ACC_B))
      accountDecrypts()

      const { store, ok } = await boot()

      expect(m.clearAllUserData).not.toHaveBeenCalled()
      expect(ok).toBe(true)
      expect(store.address).toBe(ACC_A)
    })

    it('список аккаунтов не расшифровался — остальные аккаунты не стираются, входа нет', async () => {
      m.peekPendingRegistration.mockReturnValue({ address: ACC_B, step: 1, nickname: 'b' })
      m.loadAccountsList.mockReturnValue({
        success: false,
        data: null,
        error: 'Malformed UTF-8 data',
      })
      m.loadEncryptedMnemonic.mockReturnValue({ success: true, data: MNEMONIC })

      const { store, ok } = await boot()

      expect(m.clearAllUserData).not.toHaveBeenCalled()
      expect(ok).toBe(false)
      expect(store.authState).toBe('unauthenticated')
      expect(store.isLoading).toBe(false)
      // Общая legacy-мнемоника может быть брошенной регистрации — не воскрешаем её.
      expect(m.recoverKeyPair).not.toHaveBeenCalled()
    })

    it('отметка без адреса: снимается сама отметка, аккаунты не трогаются', async () => {
      m.peekPendingRegistration.mockReturnValue({ step: 0, nickname: 'b' })
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      const { ok } = await boot()

      expect(ok).toBe(true)
      expect(m.clearPendingRegistration).toHaveBeenCalled()
      expect(m.removeAccount).not.toHaveBeenCalled()
      expect(m.clearAllUserData).not.toHaveBeenCalled()
    })
  })

  describe('конкурентные вызовы и повторы', () => {
    it('onMounted и router-guard делят одно восстановление', async () => {
      let unlock!: (v: unknown) => void
      m.ensureVaultUnlocked.mockReturnValue(new Promise((r) => (unlock = r)))
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()

      const store = useAuthStore()
      store.authState = 'restoring'
      const first = store.restoreSession()
      const second = store.restoreSession()
      // Пока идёт восстановление — индикатор загрузки.
      expect(store.isLoading).toBe(true)
      unlock({ status: 'unlocked', level: 'device' })

      expect(await Promise.all([first, second])).toEqual([true, true])
      expect(m.ensureVaultUnlocked).toHaveBeenCalledTimes(1)
      expect(m.recoverFromAccount).toHaveBeenCalledTimes(1)
      expect(m.ws.connect).toHaveBeenCalledTimes(1)
    })

    it('поднятая сессия не восстанавливается повторно (guard на каждом переходе)', async () => {
      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()
      const { store } = await boot()

      expect(await store.restoreSession()).toBe(true)
      expect(m.ensureVaultUnlocked).toHaveBeenCalledTimes(1)
      expect(m.recoverFromAccount).toHaveBeenCalledTimes(1)
    })

    it('после сбоя повтор запускается заново и сбрасывает прежнюю ошибку', async () => {
      m.ensureVaultUnlocked.mockRejectedValueOnce(new Error('transient'))
      const { store } = await boot()
      expect(store.error).toBe('transient')

      m.loadAccountsList.mockReturnValue(accountsList(ACC_A, ACC_A))
      accountDecrypts()
      expect(await store.restoreSession()).toBe(true)
      expect(store.error).toBeNull()
      expect(store.authState).toBe('authenticated')
    })
  })
})
