/**
 * Счётчик непрочитанных сообщений вне окна приложения: на значке (Dock, панель
 * задач, трей, лаунчер Android, PWA) и в заголовке вкладки «(3) …». Число —
 * то же, что на кнопке мессенджера; выключается тумблером в настройках
 * уведомлений. Как показать его системе — `services/app-badge`.
 */
import { computed, watch } from 'vue'

import { useMessengerStore } from '@/b-components/messenger/store/messenger-store'
import { setDocumentTitleUnread } from '@/composables/use-document-title'
import { APP_NAME } from '@/config/app-name'
import { i18n, t, tn } from '@/i18n'
import { ensureAppBadgePermission, showAppBadge } from '@/services/app-badge'
import { useNotificationSettingsStore } from '@/stores/notification-settings-store'

/** Счётчики приходят пачкой при синке — системе отдаём устоявшееся число. */
const SETTLE_MS = 300

export function useAppBadge(): void {
  const messenger = useMessengerStore()
  const settings = useNotificationSettingsStore()
  const count = computed(() => (settings.getFilter('appBadge') ? messenger.totalUnreadCount : 0))

  let timer: ReturnType<typeof setTimeout> | null = null
  let applied: string | null = null

  const apply = (): void => {
    const n = count.value
    setDocumentTitleUnread(n)
    // Повтор того же числа на том же языке системе не шлём.
    const key = `${n}|${i18n.global.locale.value}`
    if (key === applied) return
    applied = key
    if (n > 0) void ensureAppBadgePermission()
    void showAppBadge(n, {
      tooltip: tn('appBadge.tooltip', n, { name: APP_NAME }),
      title: APP_NAME,
      text: tn('appBadge.unread', n),
      channel: t('appBadge.channel'),
    })
  }

  watch(
    [count, () => i18n.global.locale.value],
    () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(apply, SETTLE_MS)
    },
    { immediate: true }
  )
}
