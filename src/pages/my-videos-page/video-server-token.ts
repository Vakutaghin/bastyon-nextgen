/**
 * Токен автора на видеосервере ролика: вход подписью его ключа. Входить можно
 * только туда, где у автора уже есть ролики: вход на новый сервер заводит на
 * нём аккаунт.
 */

import { useAuthStore } from '@/blockchain/store/auth-store'
import { buildPeertubeSignature, ensurePeertubeToken } from '@/services/peertube/peertube-auth'

export function useVideoServerToken(): (host: string) => Promise<string> {
  const authStore = useAuthStore()
  return async (host) => {
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress
    if (!keyPair || !address) throw new Error('signed_out')
    const signature = buildPeertubeSignature(keyPair, address)
    return (await ensurePeertubeToken({ host, address, signature })).access_token
  }
}
