// Постоянные ссылки (имена IPNS) живут в DHT около 48 часов, поэтому их
// переиздаёт само приложение: через минуту после входа и потом раз в час
// проверяет, не пора ли. Свои — раз в 12 часов (ipns-names-store.ts); чужие,
// за которыми аккаунт следит, — проверяются раз в час, а об их переводе на
// новую версию появляется уведомление (ipns-follow-store.ts). У аккаунта без
// своих и отслеживаемых имён в сеть ничего не уходит.

import { onBeforeUnmount, watch } from 'vue'
import { appToast } from '@/b-components/app-toast'
import { openIpfsViewer } from '@/composables/use-ipfs-links'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores'
import { useIpnsFollowStore } from '@/stores/ipns-follow-store'
import { useIpnsNamesStore } from '@/stores/ipns-names-store'

/** Пауза после входа: не толкаться с загрузкой ленты и чатов. */
const FIRST_CHECK_MS = 60_000
const CHECK_EVERY_MS = 3600_000

function notify(update: { name: string }): void {
  appToast.info({
    message: t('messenger.ipnsUpdated'),
    description: t('messenger.ipnsUpdatedOpen'),
    duration: 15,
    onClick: () => {
      void openIpfsViewer({ namespace: 'ipns', root: update.name, path: '' }, null, null)
    },
  })
}

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
      const follow = useIpnsFollowStore()
      follow.use(address)
      follow
        .check()
        .then((updates) => updates.forEach(notify))
        .catch((e: unknown) => console.warn('[ipns] follow check failed:', e))
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
