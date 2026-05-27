/**
 * HostContext methods: signature/account-status/registration.
 *
 * Deps инжектятся через AuthDeps — у каждого метода доступ ровно к тому,
 * что ему нужно. Pinia-сторы вызываются как функции, чтобы получить
 * актуальное состояние на каждый вызов.
 */

import type { HostContext } from '../host-context'

export interface AuthDeps {
  useAuthStore: typeof import('@/blockchain/store/auth-store').useAuthStore
  generateApiSignature: typeof import('@/blockchain/core/signatures/api-signature').generateApiSignature
}

export type AuthMethods = Pick<
  HostContext,
  'signApiMessage' | 'getCurrentAccountStatus' | 'openRegistration'
>

export function createAuthMethods(deps: AuthDeps): AuthMethods {
  const { useAuthStore, generateApiSignature } = deps
  return {
    signApiMessage: (data, options = {}) => {
      const auth = useAuthStore()
      if (!auth.keyPair || !auth.address) return null
      return generateApiSignature(auth.keyPair, auth.address, {
        data,
        expiration: options.expiration,
        useOldFormat: options.useOldFormat,
      })
    },

    getCurrentAccountStatus: () => {
      // Legacy `account.getStatus()` отдавал балансы/permissions/etc. В nextgen
      // эту аггрегацию делает отдельный composable; для миниаппы достаточно
      // получить address + signature — статус они подтягивают через `balance`
      // action отдельно.
      return undefined
    },

    openRegistration: async () => {
      const { useModalStore } = await import('@/stores/modal-store')
      useModalStore().openAuthModal('register')
    },
  }
}
