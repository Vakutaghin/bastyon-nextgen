// Кэш профилей собеседников мессенджера с батчингом запросов

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'

import { PROFILE_BATCH_SIZE, PROFILE_FETCH_DELAY } from './consts'
import { checkPeerKeys, acceptPeerKeys } from '../services/key-pinning'

export const useMessengerProfileCache = defineStore('messenger-profile-cache', () => {
  const userProfiles = ref<Record<string, UserProfile>>({})

  /**
   * Собеседники, чьи ключи шифрования (`k`) отличаются от закреплённых при
   * первом контакте (TOFU, аудит P3-3). Пока пользователь не примет новые ключи,
   * чат показывает предупреждение. Ключ — адрес собеседника.
   */
  const changedKeyPeers = ref<Record<string, true>>({})
  const warnedThisSession = new Set<string>()

  const ownerAddress = (): string => useAuthStore().getUserAddress || ''

  const verifyPeerKeys = (profile: UserProfile): void => {
    const owner = ownerAddress()
    if (!owner || !profile.address || profile.address === owner) return
    const keys = typeof profile.k === 'string' ? profile.k : ''
    if (!keys) return
    const result = checkPeerKeys(owner, profile.address, keys)
    if (result !== 'changed') {
      if (changedKeyPeers.value[profile.address]) {
        const next = { ...changedKeyPeers.value }
        delete next[profile.address]
        changedKeyPeers.value = next
      }
      return
    }
    changedKeyPeers.value = { ...changedKeyPeers.value, [profile.address]: true }
    if (!warnedThisSession.has(profile.address)) {
      warnedThisSession.add(profile.address)
      console.warn('[ProfileCache] messenger keys changed for', profile.address)
      appToast.warning({
        message: t('appMsg.messenger.keyChanged', { name: profile.name || profile.address }),
      })
    }
  }

  /** Пользователь осознанно принял новые ключи собеседника — предупреждение снимается. */
  const acceptChangedKeys = (address: string): void => {
    const profile = userProfiles.value[address]
    const keys = typeof profile?.k === 'string' ? profile.k : ''
    if (keys) acceptPeerKeys(ownerAddress(), address, keys)
    const next = { ...changedKeyPeers.value }
    delete next[address]
    changedKeyPeers.value = next
  }

  // Очередь и резолверы для батчирования запросов
  const pendingResolvers = new Map<string, Array<() => void>>()
  let fetchQueue: string[] = []
  let fetchTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Обрабатывает очередь адресов — загружает профили батчами.
   */
  const processQueue = async () => {
    if (fetchQueue.length === 0) return

    const addressesToFetch = [...new Set(fetchQueue)]
    fetchQueue = []

    const batches: string[][] = []
    for (let i = 0; i < addressesToFetch.length; i += PROFILE_BATCH_SIZE) {
      batches.push(addressesToFetch.slice(i, i + PROFILE_BATCH_SIZE))
    }

    for (const batch of batches) {
      try {
        const result = await getByPRC({
          method: rpcEndpoints.getUserProfile,
          parameters: [[...batch]],
          cachehash: Date.now().toString() + Math.random().toString(),
        })

        const profiles = Array.isArray(result)
          ? result
          : ((result as { data?: unknown } | null)?.data ?? [])

        if (Array.isArray(profiles)) {
          profiles.forEach((profile: UserProfile) => {
            if (profile?.address) {
              userProfiles.value[profile.address] = profile
              verifyPeerKeys(profile)
            }
          })
        }
      } catch (e) {
        console.error('[ProfileCache] Ошибка загрузки батча профилей:', e)
      } finally {
        batch.forEach((addr) => {
          const resolvers = pendingResolvers.get(addr)
          if (resolvers) {
            resolvers.forEach((r) => r())
            pendingResolvers.delete(addr)
          }
        })
      }
    }
  }

  /**
   * Запрашивает загрузку профилей. Отсутствующие добавляются в очередь.
   * Возвращает Promise, который резолвится когда все профили загружены.
   */
  const fetchProfiles = (addresses: string[]): Promise<void> => {
    const missing = addresses.filter((a) => !userProfiles.value[a])
    if (missing.length === 0) return Promise.resolve()

    const promises: Promise<void>[] = []

    missing.forEach((a) => {
      if (!pendingResolvers.has(a)) {
        pendingResolvers.set(a, [])
        fetchQueue.push(a)
      }

      const p = new Promise<void>((resolve) => {
        const resolvers = pendingResolvers.get(a)
        if (resolvers) resolvers.push(resolve)
        else resolve()
      })
      promises.push(p)
    })

    if (fetchTimeout) clearTimeout(fetchTimeout)
    fetchTimeout = setTimeout(processQueue, PROFILE_FETCH_DELAY)

    return Promise.all(promises).then(() => {})
  }

  /**
   * Резолвит URL аватара из профиля по адресу.
   * Использует общий resolveImageUrl для нормализации.
   */
  const getAvatarUrl = (imageHash?: string): string | undefined => {
    if (!imageHash) return undefined
    return resolveImageUrl(imageHash)
  }

  /** Полный сброс кэша при логауте */
  const reset = () => {
    userProfiles.value = {}
    changedKeyPeers.value = {}
    warnedThisSession.clear()
    pendingResolvers.clear()
    fetchQueue = []
    if (fetchTimeout) clearTimeout(fetchTimeout)
  }

  return {
    userProfiles,
    changedKeyPeers,
    fetchProfiles,
    acceptChangedKeys,
    getAvatarUrl,
    reset,
  }
})
