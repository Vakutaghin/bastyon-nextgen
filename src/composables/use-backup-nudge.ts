// Ненавязчивое повторяющееся напоминание о резервной копии (VP-8, решение 1b плана
// сейфа: «тихо + storage.persist + non-blocking recurring nudge»). Пока бэкап
// не проверен (или проверка старше 90 дней) — раз в 7 дней после входа тост
// с переходом в Настройки → Приватный ключ. Никогда не блокирует.

import { watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { shouldNudgeBackup, markBackupNudged } from '@/helpers/backup/backup-verification'

/** Пауза после входа, чтобы не толкаться с тостами бута/уведомлений. */
const NUDGE_DELAY_MS = 8_000

export function useBackupNudge(enabled: () => boolean = () => true): void {
  const authStore = useAuthStore()
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const schedule = (address: string): void => {
    cancel()
    timer = setTimeout(() => {
      timer = null
      if (!enabled() || !authStore.isUserAuthenticated) return
      if (authStore.getUserAddress !== address) return
      if (!shouldNudgeBackup(address)) return
      markBackupNudged()
      appToast.warning({
        message: t('vault.backupNudgeTitle'),
        description: t('vault.backupNudgeBody'),
        duration: 12,
        onClick: () => {
          void router.push({ name: 'settings', query: { tab: 'privateKey' } })
        },
      })
    }, NUDGE_DELAY_MS)
  }

  watch(
    () => (authStore.isUserAuthenticated ? authStore.getUserAddress || '' : ''),
    (address) => {
      if (address) schedule(address)
      else cancel()
    },
    { immediate: true }
  )

  onBeforeUnmount(cancel)
}
