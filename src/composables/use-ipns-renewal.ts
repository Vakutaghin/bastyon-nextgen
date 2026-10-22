// Постоянные ссылки аккаунта (свои имена IPNS) живут в DHT около 48 часов,
// поэтому их переиздаёт само приложение: через минуту после входа и потом раз
// в час проверяет, не пора ли. Пора — раз в 12 часов (ipns-names-store.ts);
// у аккаунта без своих имён в сеть ничего не уходит.

import { onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '@/stores'
import { useIpnsNamesStore } from '@/stores/ipns-names-store'

/** Пауза после входа: не толкаться с загрузкой ленты и чатов. */
const FIRST_CHECK_MS = 60_000
const CHECK_EVERY_MS = 3600_000

export function useIpnsRenewal(enabled: () => boolean = () => true): void {
  const auth = useAuthStore()
  let timer: ReturnType<typeof setTimeout> | null = null

  const stop = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const schedule = (address: string, delay: number): void => {
    stop()
    timer = setTimeout(() => {
      schedule(address, CHECK_EVERY_MS)
      if (!enabled() || auth.getUserAddress !== address) return
      const names = useIpnsNamesStore()
      names.use(address)
      names.renew().catch((e: unknown) => console.warn('[ipns] renew failed:', e))
    }, delay)
  }

  watch(
    () => auth.getUserAddress,
    (address) => {
      if (address) schedule(address, FIRST_CHECK_MS)
      else stop()
    },
    { immediate: true }
  )

  onBeforeUnmount(stop)
}
