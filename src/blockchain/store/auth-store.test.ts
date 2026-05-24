import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { useAuthStore } from './auth-store'

// ---------------------------------------------------------------------------
// vi.hoisted() — these fns are created *before* vi.mock factories run,
// so they can be referenced inside the hoisted mock bodies.
// ---------------------------------------------------------------------------

const {
  _saveMnemonic,
  _addAccountForAddress,
  _addAccountWithoutMnemonic,
  _getAccountsList,
  _getAccountsInfo,
  _recoverFromAccount,
  _removeAccount,
  _fetchUserState,
  _fetchUserProfile,
  _clearProfile,
} = vi.hoisted(() => ({
  _saveMnemonic: vi.fn().mockResolvedValue(undefined),
  _addAccountForAddress: vi.fn(),
  _addAccountWithoutMnemonic: vi.fn(),
  _getAccountsList: vi.fn().mockReturnValue({ accounts: [], currentAccount: null }),
  _getAccountsInfo: vi.fn().mockReturnValue([]),
  _recoverFromAccount: vi.fn().mockResolvedValue(null),
  _removeAccount: vi.fn().mockReturnValue(true),
  _fetchUserState: vi.fn().mockResolvedValue(null),
  _fetchUserProfile: vi.fn().mockResolvedValue(null),
  _clearProfile: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mocks – we mock every heavy dependency so the store can be tested in
// isolation without crypto libs, network, or localStorage.
// ---------------------------------------------------------------------------

vi.mock('../core/keys', () => ({
  generateKeys: vi.fn(),
  recoverKeyPair: vi.fn(),
  loadBip39Russian: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../storage', () => ({
  loadEncryptedMnemonic: vi.fn().mockReturnValue({ success: false }),
  saveWasLogged: vi.fn(),
  clearAllUserData: vi.fn(),
  loadAccountsList: vi.fn().mockReturnValue({ success: false }),
  hasStoredSession: vi.fn().mockReturnValue(false),
  updateAccountName: vi.fn().mockReturnValue({ success: true }),
}))

vi.mock('../wallet-addresses', () => ({
  deriveAndSaveWalletAddresses: vi.fn(),
}))

vi.mock('../ws', () => ({
  wsService: {
    connect: vi.fn(),
    close: vi.fn(),
  },
}))

// We use the *same* `defineStore` from pinia ESM so that mock stores
// share the active pinia set via `setActivePinia` in beforeEach.
vi.mock('./keys-store', () => ({
  useKeysStore: defineStore('keys', {
    state: () => ({
      keyPair: null as any,
      address: null as string | null,
      accountsList: null as any,
    }),
    actions: {
      setKeyPair(kp: any) {
        this.keyPair = kp
        this.address = 'PTestAddress123'
      },
      clearKeys() {
        this.keyPair = null
        this.address = null
        this.accountsList = null
      },
      saveMnemonic: _saveMnemonic,
      addAccountForAddress: _addAccountForAddress,
      addAccountWithoutMnemonic: _addAccountWithoutMnemonic,
      getAccountsList: _getAccountsList,
      getAccountsInfo: _getAccountsInfo,
      recoverFromAccount: _recoverFromAccount,
      removeAccount: _removeAccount,
    },
  }),
}))

vi.mock('./profile-store', () => ({
  useProfileStore: defineStore('profile', {
    state: () => ({
      userProfile: null as any,
      userAvatarUrl: null as string | null,
      isFetchingUserState: false,
    }),
    actions: {
      fetchUserState: _fetchUserState,
      fetchUserProfile: _fetchUserProfile,
      clearProfile: _clearProfile,
    },
  }),
}))

// Prevent dynamic imports from failing (invalidateAllQueries / resetMessenger)
vi.mock('../../query-client', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/b-components/messenger/store', () => ({
  useMessengerStore: vi.fn().mockReturnValue({
    logout: vi.fn(),
    initMatrix: vi.fn().mockResolvedValue(undefined),
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeKeyPair() {
  return {
    privateKey: Buffer.from('ab'.repeat(32), 'hex'),
    publicKey: Buffer.from('cd'.repeat(33), 'hex'),
    ecPair: {} as any,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Re-set default returns after clearAllMocks
    _saveMnemonic.mockResolvedValue(undefined)
    _getAccountsList.mockReturnValue({ accounts: [], currentAccount: null })
    _getAccountsInfo.mockReturnValue([])
    _recoverFromAccount.mockResolvedValue(null)
    _removeAccount.mockReturnValue(true)
    _fetchUserState.mockResolvedValue(null)
    _fetchUserProfile.mockResolvedValue(null)
  })

  // ── Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should start unauthenticated', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
      expect(store.authState).toBe('unauthenticated')
    })

    it('should have null address, keyPair, userProfile', () => {
      const store = useAuthStore()
      expect(store.address).toBeNull()
      expect(store.keyPair).toBeNull()
      expect(store.userProfile).toBeNull()
    })

    it('should not be loading and have no error', () => {
      const store = useAuthStore()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should have null userAvatarUrl and accountsList', () => {
      const store = useAuthStore()
      expect(store.userAvatarUrl).toBeNull()
      expect(store.accountsList).toBeNull()
    })
  })

  // ── Getters ────────────────────────────────────────────────────────────

  describe('getters', () => {
    it('isUserAuthenticated returns false when not authenticated', () => {
      const store = useAuthStore()
      expect(store.isUserAuthenticated).toBe(false)
    })

    it('isUserAuthenticated returns false when isAuthenticated=true but authState!="authenticated"', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.authState = 'authenticating'
      expect(store.isUserAuthenticated).toBe(false)
    })

    it('isUserAuthenticated returns true when both conditions met', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.authState = 'authenticated'
      expect(store.isUserAuthenticated).toBe(true)
    })

    it('getUserAddress returns the current address', () => {
      const store = useAuthStore()
      expect(store.getUserAddress).toBeNull()
      store.address = 'PAddr123'
      expect(store.getUserAddress).toBe('PAddr123')
    })

    it('getKeyPair returns the current keyPair', () => {
      const store = useAuthStore()
      expect(store.getKeyPair).toBeNull()
      const kp = fakeKeyPair()
      store.keyPair = kp
      // Pinia getters return reactive proxies; use deep equality
      expect(store.getKeyPair).toEqual(kp)
    })

    it('isAuthLoading reflects isLoading state', () => {
      const store = useAuthStore()
      expect(store.isAuthLoading).toBe(false)
      store.isLoading = true
      expect(store.isAuthLoading).toBe(true)
    })

    it('getAuthError reflects error state', () => {
      const store = useAuthStore()
      expect(store.getAuthError).toBeNull()
      store.error = 'something went wrong'
      expect(store.getAuthError).toBe('something went wrong')
    })

    it('getUserProfile returns the profile', () => {
      const store = useAuthStore()
      expect(store.getUserProfile).toBeNull()
      const profile = { address: 'PAddr', name: 'Alice' } as any
      store.userProfile = profile
      expect(store.getUserProfile).toEqual(profile)
    })

    it('getUserAvatarUrl returns userAvatarUrl when set directly', () => {
      const store = useAuthStore()
      store.userAvatarUrl = 'https://avatar.url/img.png'
      expect(store.getUserAvatarUrl).toBe('https://avatar.url/img.png')
    })

    it('getUserAvatarUrl falls back to profile.i', () => {
      const store = useAuthStore()
      store.userProfile = { i: 'https://profile.img/avatar.jpg' } as any
      expect(store.getUserAvatarUrl).toBe('https://profile.img/avatar.jpg')
    })

    it('getUserAvatarUrl returns null when nothing set', () => {
      const store = useAuthStore()
      expect(store.getUserAvatarUrl).toBeNull()
    })

    it('getUserState returns profile if it contains score_unspent or post_unspent', () => {
      const store = useAuthStore()
      expect(store.getUserState).toBeNull()

      const stateData = { address: 'PAddr', score_unspent: 5 } as any
      store.userProfile = stateData
      expect(store.getUserState).toEqual(stateData)
    })

    it('getUserState returns null for profile without state fields', () => {
      const store = useAuthStore()
      store.userProfile = { address: 'PAddr', name: 'Alice' } as any
      expect(store.getUserState).toBeNull()
    })

    it('hasUserState returns true when state fields present', () => {
      const store = useAuthStore()
      expect(store.hasUserState).toBe(false)
      store.userProfile = { post_unspent: 3 } as any
      expect(store.hasUserState).toBe(true)
    })
  })

  // ── Helper actions ─────────────────────────────────────────────────────

  describe('setLoading', () => {
    it('should update isLoading', () => {
      const store = useAuthStore()
      store.setLoading(true)
      expect(store.isLoading).toBe(true)
      store.setLoading(false)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set the error string and move authState to "error"', () => {
      const store = useAuthStore()
      store.setError('Network failure')
      expect(store.error).toBe('Network failure')
      expect(store.authState).toBe('error')
    })

    it('should accept null to clear the error without changing authState to error', () => {
      const store = useAuthStore()
      store.setError(null)
      expect(store.error).toBeNull()
      // null is falsy so authState should NOT be moved to 'error'
      expect(store.authState).toBe('unauthenticated')
    })
  })

  describe('clearError', () => {
    it('should clear the error and restore authState based on isAuthenticated (false)', () => {
      const store = useAuthStore()
      store.setError('oops')
      store.clearError()
      expect(store.error).toBeNull()
      expect(store.authState).toBe('unauthenticated')
    })

    it('should restore authState to "authenticated" if isAuthenticated is true', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.setError('oops')
      store.clearError()
      expect(store.authState).toBe('authenticated')
    })
  })

  describe('resetAuthOnRegistrationError', () => {
    it('should reset auth-related state', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.authState = 'authenticated'
      store.address = 'PAddr'
      store.keyPair = fakeKeyPair()

      store.resetAuthOnRegistrationError()

      expect(store.isAuthenticated).toBe(false)
      expect(store.authState).toBe('unauthenticated')
      expect(store.address).toBeNull()
      expect(store.keyPair).toBeNull()
    })
  })

  // ── Auth state transitions ─────────────────────────────────────────────

  describe('auth state transitions', () => {
    it('unauthenticated -> authenticating -> authenticated (happy path)', () => {
      const store = useAuthStore()
      expect(store.authState).toBe('unauthenticated')

      store.authState = 'authenticating'
      expect(store.authState).toBe('authenticating')

      store.isAuthenticated = true
      store.authState = 'authenticated'
      expect(store.authState).toBe('authenticated')
      expect(store.isUserAuthenticated).toBe(true)
    })

    it('unauthenticated -> authenticating -> error', () => {
      const store = useAuthStore()
      store.authState = 'authenticating'
      store.setError('Auth failed')

      expect(store.authState).toBe('error')
      expect(store.isUserAuthenticated).toBe(false)
    })

    it('authenticated -> unauthenticated (sign out path)', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.authState = 'authenticated'

      store.isAuthenticated = false
      store.authState = 'unauthenticated'

      expect(store.isUserAuthenticated).toBe(false)
      expect(store.authState).toBe('unauthenticated')
    })

    it('error -> cleared back to unauthenticated', () => {
      const store = useAuthStore()
      store.setError('fail')
      expect(store.authState).toBe('error')

      store.clearError()
      expect(store.authState).toBe('unauthenticated')
    })

    it('error -> cleared back to authenticated if isAuthenticated', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.setError('transient')
      expect(store.authState).toBe('error')

      store.clearError()
      expect(store.authState).toBe('authenticated')
    })
  })

  // ── validateAuth ───────────────────────────────────────────────────────

  describe('validateAuth', () => {
    it('returns false when not authenticated', () => {
      const store = useAuthStore()
      expect(store.validateAuth()).toBe(false)
    })

    it('returns false when authenticated but missing keyPair', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.address = 'PAddr'
      expect(store.validateAuth()).toBe(false)
    })

    it('returns false when authenticated but missing address', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.keyPair = fakeKeyPair()
      expect(store.validateAuth()).toBe(false)
    })

    it('returns false when address is empty string', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.keyPair = fakeKeyPair()
      store.address = ''
      expect(store.validateAuth()).toBe(false)
    })

    it('returns true when fully authenticated with keyPair and valid address', () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.keyPair = fakeKeyPair()
      store.address = 'PAddr123'
      expect(store.validateAuth()).toBe(true)
    })
  })

  // ── isItMe ─────────────────────────────────────────────────────────────

  describe('isItMe', () => {
    it('returns false when argument is null', () => {
      const store = useAuthStore()
      store.address = 'PAddr'
      expect(store.isItMe(null)).toBe(false)
    })

    it('returns false when store address is null', () => {
      const store = useAuthStore()
      expect(store.isItMe('PAddr')).toBe(false)
    })

    it('returns false when addresses differ', () => {
      const store = useAuthStore()
      store.address = 'PAddr1'
      expect(store.isItMe('PAddr2')).toBe(false)
    })

    it('returns true when addresses match', () => {
      const store = useAuthStore()
      store.address = 'PAddr123'
      expect(store.isItMe('PAddr123')).toBe(true)
    })
  })

  // ── signOut ────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('should reset all auth-related state', async () => {
      const store = useAuthStore()
      store.isAuthenticated = true
      store.authState = 'authenticated'
      store.address = 'PAddr'
      store.keyPair = fakeKeyPair()
      store.userProfile = { address: 'PAddr' } as any
      store.userAvatarUrl = 'https://img.url'
      store.error = 'previous error'
      store.accountsList = { accounts: [], currentAccount: null }

      await store.signOut()

      expect(store.isAuthenticated).toBe(false)
      expect(store.authState).toBe('unauthenticated')
      expect(store.address).toBeNull()
      expect(store.keyPair).toBeNull()
      expect(store.userProfile).toBeNull()
      expect(store.userAvatarUrl).toBeNull()
      expect(store.error).toBeNull()
      expect(store.accountsList).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('should call wsService.close()', async () => {
      const { wsService } = await import('../ws')
      const store = useAuthStore()
      await store.signOut()
      expect(wsService.close).toHaveBeenCalled()
    })

    it('should call clearAllUserData()', async () => {
      const { clearAllUserData } = await import('../storage')
      const store = useAuthStore()
      await store.signOut()
      expect(clearAllUserData).toHaveBeenCalled()
    })

    it('should call keys-store clearKeys and profile-store clearProfile', async () => {
      const store = useAuthStore()
      await store.signOut()

      const { useKeysStore } = await import('./keys-store')
      const keysStore = useKeysStore()
      expect(keysStore.keyPair).toBeNull()
      expect(keysStore.address).toBeNull()

      expect(_clearProfile).toHaveBeenCalled()
    })
  })

  // ── _syncFromKeysStore / _syncFromProfileStore ─────────────────────────

  describe('_syncFromKeysStore', () => {
    it('should copy keyPair, address, and accountsList from keys store', () => {
      const store = useAuthStore()

      const kp = fakeKeyPair()
      store.setKeyPair(kp)

      // After setKeyPair -> keys-store.setKeyPair -> address = 'PTestAddress123'
      expect(store.keyPair).toEqual(kp)
      expect(store.address).toBe('PTestAddress123')
    })
  })

  describe('_syncFromProfileStore', () => {
    it('should copy profile data from profile store', () => {
      const store = useAuthStore()

      store._syncFromProfileStore()

      expect(store.userProfile).toBeNull()
      expect(store.userAvatarUrl).toBeNull()
      expect(store.isFetchingUserState).toBe(false)
    })
  })

  // ── register ───────────────────────────────────────────────────────────

  describe('register', () => {
    it('should generate keys, authenticate, and return mnemonic + address + keyPair', async () => {
      const { generateKeys } = await import('../core/keys')
      const kp = fakeKeyPair()
      ;(generateKeys as any).mockReturnValue({
        mnemonic: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
        keyPair: kp,
      })

      vi.doMock('../core/addresses', () => ({
        generateAddressFromKeyPair: vi.fn().mockReturnValue({
          addressInfo: { address: 'PRegisteredAddr' },
        }),
      }))

      const store = useAuthStore()
      const result = await store.register()

      expect(result.mnemonic).toBe('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12')
      expect(result.keyPair).toEqual(kp)
      expect(store.isAuthenticated).toBe(true)
      expect(store.authState).toBe('authenticated')
      expect(store.isLoading).toBe(false)
    })

    it('should transition through authenticating state', async () => {
      const { generateKeys } = await import('../core/keys')
      const kp = fakeKeyPair()
      ;(generateKeys as any).mockReturnValue({ mnemonic: 'mnemonic words', keyPair: kp })

      vi.doMock('../core/addresses', () => ({
        generateAddressFromKeyPair: vi.fn().mockReturnValue({
          addressInfo: { address: 'PAddr' },
        }),
      }))

      const store = useAuthStore()
      const states: string[] = []
      store.$subscribe(() => {
        states.push(store.authState)
      })

      await store.register()

      expect(states).toContain('authenticating')
      expect(store.authState).toBe('authenticated')
    })

    it('should reset state and throw on failure', async () => {
      const { generateKeys } = await import('../core/keys')
      ;(generateKeys as any).mockImplementation(() => {
        throw new Error('Key generation failed')
      })

      const store = useAuthStore()

      await expect(store.register()).rejects.toThrow('Key generation failed')

      expect(store.isAuthenticated).toBe(false)
      // The catch block sets authState='unauthenticated' then calls setError()
      // which overrides it to 'error' when a non-null error string is passed.
      expect(store.authState).toBe('error')
      expect(store.address).toBeNull()
      expect(store.keyPair).toBeNull()
      expect(store.error).toBe('Key generation failed')
      expect(store.isLoading).toBe(false)
    })
  })

  // ── signIn ─────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('should return { success: false } when privateKey is empty', async () => {
      const store = useAuthStore()
      const result = await store.signIn({ privateKey: '' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(store.authState).toBe('error')
    })

    it('should return { success: false } when recoverKeyPair returns null', async () => {
      const { recoverKeyPair } = await import('../core/keys')
      ;(recoverKeyPair as any).mockReturnValue(null)

      const store = useAuthStore()
      const result = await store.signIn({ privateKey: 'some-invalid-key' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to recover key pair')
    })

    it('should authenticate successfully with valid key', async () => {
      const { recoverKeyPair } = await import('../core/keys')
      const kp = fakeKeyPair()
      ;(recoverKeyPair as any).mockReturnValue({
        keyPair: kp,
        format: 'hex',
        source: 'deadbeef',
      })

      const store = useAuthStore()
      const result = await store.signIn({ privateKey: 'deadbeef' })

      expect(result.success).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.authState).toBe('authenticated')
      expect(store.isLoading).toBe(false)
    })

    it('should call saveWasLogged after successful sign in', async () => {
      const { recoverKeyPair } = await import('../core/keys')
      const { saveWasLogged } = await import('../storage')
      const kp = fakeKeyPair()
      ;(recoverKeyPair as any).mockReturnValue({
        keyPair: kp,
        format: 'hex',
        source: 'deadbeef',
      })

      const store = useAuthStore()
      await store.signIn({ privateKey: 'deadbeef' })

      expect(saveWasLogged).toHaveBeenCalledWith(true)
    })

    it('should call wsService.connect on successful sign in', async () => {
      const { recoverKeyPair } = await import('../core/keys')
      const { wsService } = await import('../ws')
      const kp = fakeKeyPair()
      ;(recoverKeyPair as any).mockReturnValue({
        keyPair: kp,
        format: 'hex',
        source: 'deadbeef',
      })

      const store = useAuthStore()
      await store.signIn({ privateKey: 'deadbeef' })

      expect(wsService.connect).toHaveBeenCalled()
    })

    it('should save mnemonic when recovery format is "mnemonic"', async () => {
      const { recoverKeyPair } = await import('../core/keys')
      const kp = fakeKeyPair()
      ;(recoverKeyPair as any).mockReturnValue({
        keyPair: kp,
        format: 'mnemonic',
        source: 'word1 word2 word3',
      })

      const store = useAuthStore()
      await store.signIn({ privateKey: 'word1 word2 word3' })

      expect(_saveMnemonic).toHaveBeenCalledWith('word1 word2 word3')
    })
  })

  // ── fetchUserState (delegated) ─────────────────────────────────────────

  describe('fetchUserState', () => {
    it('should delegate to profile-store and sync result', async () => {
      const store = useAuthStore()
      store.address = 'PAddr'

      const result = await store.fetchUserState()

      expect(result).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(_fetchUserState).toHaveBeenCalledWith('PAddr')
    })

    it('should set error on failure', async () => {
      _fetchUserState.mockRejectedValueOnce(new Error('Network error'))

      const store = useAuthStore()
      store.address = 'PAddr'
      const result = await store.fetchUserState()

      expect(result).toBeNull()
      expect(store.error).toBe('Network error')
      expect(store.isLoading).toBe(false)
    })
  })

  // ── fetchUserProfile (delegated) ───────────────────────────────────────

  describe('fetchUserProfile', () => {
    it('should return null when no address is provided and store has no address', async () => {
      const store = useAuthStore()
      const result = await store.fetchUserProfile()
      expect(result).toBeNull()
    })

    it('should delegate to profile-store with the given address', async () => {
      const mockProfile = { address: 'PTarget', name: 'Bob' }
      _fetchUserProfile.mockResolvedValueOnce(mockProfile)

      const store = useAuthStore()
      const result = await store.fetchUserProfile('PTarget')

      expect(_fetchUserProfile).toHaveBeenCalledWith('PTarget')
      expect(result).toEqual(mockProfile)
      expect(store.isLoading).toBe(false)
    })

    it('should use store address when no address argument is given', async () => {
      const mockProfile = { address: 'PMyAddr', name: 'Me' }
      _fetchUserProfile.mockResolvedValueOnce(mockProfile)

      const store = useAuthStore()
      store.address = 'PMyAddr'
      const result = await store.fetchUserProfile()

      expect(_fetchUserProfile).toHaveBeenCalledWith('PMyAddr')
      expect(result).toEqual(mockProfile)
    })

    it('should set error on failure', async () => {
      _fetchUserProfile.mockRejectedValueOnce(new Error('Profile fetch failed'))

      const store = useAuthStore()
      const result = await store.fetchUserProfile('PAddr')

      expect(result).toBeNull()
      expect(store.error).toBe('Profile fetch failed')
      expect(store.isLoading).toBe(false)
    })
  })
})
