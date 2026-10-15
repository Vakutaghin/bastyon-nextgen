/**
 * Платные подписчики автора: все платежи ему за год (один запрос) и его
 * обычные подписчики — без обычной подписки платные посты не откроются,
 * и автору стоит это видеть.
 */

import { ref } from 'vue'
import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { fetchSubscriptionPayments } from '@/helpers/paid-subscription/payments-api'
import type { SubscriptionPayment } from '@/helpers/paid-subscription/status'

type RawFollower = { address?: string; adddress?: string }

/** Подписчики адреса (legacy: getusersubscribers [адрес, '', '', 0, 5000]). */
async function fetchFollowers(address: string): Promise<Set<string>> {
  const list = await rpcCall<RawFollower[]>({
    method: rpcEndpoints.getUserSubscribers,
    parameters: [address, '', '', 0, 5000],
    options: { auth: false },
  })
  const followers = new Set<string>()
  for (const item of Array.isArray(list) ? list : []) {
    const follower = item?.adddress ?? item?.address
    if (typeof follower === 'string' && follower) followers.add(follower)
  }
  return followers
}

export function useMySubscribers() {
  const payments = ref<SubscriptionPayment[] | null>(null)
  /** null — список подписчиков не пришёл: предупреждений тогда не показываем. */
  const followers = ref<Set<string> | null>(null)
  const loading = ref(false)
  const failed = ref(false)

  async function load(address: string): Promise<void> {
    if (!address || loading.value) return
    loading.value = true
    failed.value = false
    // Список подписчиков бывает долгим (до 5000): платежи показываем, не дожидаясь
    // его, а пометки «не подписан» появятся, когда он придёт.
    void fetchFollowers(address).then(
      (list) => (followers.value = list),
      () => (followers.value = null)
    )
    try {
      payments.value = await fetchSubscriptionPayments({ to: address })
    } catch (e) {
      console.warn('[paidSubscriptions] subscribers failed', e)
      failed.value = true
    } finally {
      loading.value = false
    }
  }

  return { payments, followers, loading, failed, load }
}
