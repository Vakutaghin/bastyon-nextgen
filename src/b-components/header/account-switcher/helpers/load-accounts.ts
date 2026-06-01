// Загрузка списка аккаунтов с обогащением профилями через RPC getuserprofile.
// Для текущего пользователя данные берутся напрямую из стора без RPC (свежие в памяти).

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { extractAvatarFromProfile } from '@/helpers/common/profile-avatar'
import type { Address } from '@/blockchain/types/addresses'
import type { UserProfile, GetUserProfileResponse } from '@/types/rpc-responses/user-get'
import type { AccountInfo } from '@/blockchain/types/auth'
import type { AccountDisplayInfo } from '../types'

interface LoadAccountsContext {
  accountsInfo: AccountInfo[]
  currentAddress: Address | null
  currentUserProfile: UserProfile | null
}

/**
 * Проверяет, что профиль помечен как «реальный» (verified):
 * badges содержат verificated/verified, ИЛИ flags.real / real-truthy.
 */
function isProfileVerified(profile: UserProfile | null): boolean {
  if (!profile) return false
  const badges = profile.badges
  if (Array.isArray(badges) && (badges.includes('verificated') || badges.includes('verified'))) {
    return true
  }
  const real = (profile.flags && profile.flags.real) ?? profile.real
  return real === 1 || real === '1' || real === true || real === 'true'
}

/** Маппит профиль (или null) в AccountDisplayInfo с учётом fallback'ов. */
function buildDisplayInfo(
  acc: AccountInfo,
  profile: UserProfile | null,
  loading: boolean
): AccountDisplayInfo {
  if (!profile) {
    return {
      address: acc.address,
      name: acc.name || null,
      avatar: null,
      balance: null,
      loading,
      verified: false,
    }
  }
  return {
    address: acc.address,
    name: profile.name || acc.name || null,
    avatar: extractAvatarFromProfile(profile) ?? null,
    balance: profile.balance ?? null,
    loading: false,
    verified: isProfileVerified(profile),
  }
}

const freshCacheHash = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2)

/**
 * Загружает аккаунты + их профили. Возвращает массив для прямой подстановки в state.
 * Для текущего пользователя профиль из стора используется без RPC; для остальных —
 * один батч-запрос getuserprofile.
 *
 * При ошибке RPC возвращает аккаунты без профилей (loading: false).
 */
export async function loadAccounts(ctx: LoadAccountsContext): Promise<AccountDisplayInfo[]> {
  const { accountsInfo, currentAddress, currentUserProfile } = ctx

  // Первичная сборка списка: для текущего юзера — из стора, остальные — с loading: true.
  const accounts: AccountDisplayInfo[] = accountsInfo.map((acc) => {
    if (acc.address === currentAddress && currentUserProfile) {
      return buildDisplayInfo(acc, currentUserProfile, false)
    }
    return buildDisplayInfo(acc, null, true)
  })

  // RPC только для тех, чьи профили ещё не загружены.
  const addressesToFetch = accountsInfo
    .map((acc) => acc.address)
    .filter((addr) => !(addr === currentAddress && currentUserProfile))

  if (addressesToFetch.length === 0) return accounts

  try {
    const response = (await getByPRCWithAuth({
      method: rpcEndpoints.getUserProfile,
      parameters: [addressesToFetch],
      cachehash: freshCacheHash(),
      options: { auth: false },
    })) as GetUserProfileResponse

    if (response.result === 'success' && response.data) {
      return accounts.map((acc) => {
        const profile = response.data.find((p) => p && p.address === acc.address)
        if (profile) {
          // Сохраняем acc.name как fallback (на случай если RPC вернул профиль без name).
          const accountInfo = accountsInfo.find((a) => a.address === acc.address)
          return buildDisplayInfo(accountInfo!, profile, false)
        }
        return { ...acc, loading: false }
      })
    }
    return accounts.map((acc) => ({ ...acc, loading: false }))
  } catch (error) {
    console.error('Failed to fetch accounts profiles:', error)
    return accounts.map((acc) => ({ ...acc, loading: false }))
  }
}
