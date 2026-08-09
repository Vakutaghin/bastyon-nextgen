// Действия отношений на сайдбаре профиля: подписка/уведомления (bell)/блокировка
// с тостами, плюс gating (canShowSubscribe/isOwnProfile). Гидрирует relations при
// авторизации. Вынесено из profile-sidebar.vue (см. LARGE_FILE_SPLIT_AUDIT.md).
import { computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'

export function useProfileRelationsActions(userAddress: Ref<string>) {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const relations = useUserRelationsStore()

  // ── Подписка (follow) ───────────────────────────────────────────────
  const isSubscribed = computed<boolean>(() => relations.isSubscribed(userAddress.value))
  const isSubscribedPrivate = computed<boolean>(() =>
    relations.isSubscribedPrivate(userAddress.value)
  )
  const isSubscribePending = computed<boolean>(() =>
    relations.isSubscribePending(userAddress.value)
  )

  // ── Блокировка пользователя ─────────────────────────────────────────
  const isBlocked = computed<boolean>(() => relations.isBlocked(userAddress.value))
  const isBlockPending = computed<boolean>(() => relations.isPending(userAddress.value))

  // Кнопка видна только авторизованному пользователю и не на собственном профиле.
  const canShowSubscribe = computed<boolean>(
    () =>
      !!userAddress.value &&
      authStore.isAuthenticated &&
      authStore.getUserAddress !== userAddress.value
  )

  // На собственном профиле вместо подписки показываем «Редактировать профиль».
  const isOwnProfile = computed<boolean>(
    () => !!userAddress.value && authStore.getUserAddress === userAddress.value
  )

  async function onBlockClick(): Promise<void> {
    const address = userAddress.value
    if (!address || isBlockPending.value) return
    try {
      if (isBlocked.value) {
        await relations.unblock(address)
        appToast.success({ message: t('comments.unblocked') })
      } else {
        await relations.block(address)
        appToast.success({ message: t('comments.blocked') })
      }
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
    }
  }

  async function onPrimaryClick(): Promise<void> {
    const address = userAddress.value
    if (!address || isSubscribePending.value) return
    try {
      if (isSubscribed.value) {
        await relations.unsubscribe(address)
        appToast.success({ message: t('subscriptions.unsubscribedToast') })
      } else {
        await relations.subscribe(address)
        appToast.success({ message: t('subscriptions.subscribedToast') })
      }
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
    }
  }

  async function onBellClick(): Promise<void> {
    const address = userAddress.value
    if (!address || isSubscribePending.value) return
    try {
      if (isSubscribedPrivate.value) {
        // Выключить уведомления, оставшись подписанным (публичная подписка).
        await relations.subscribe(address)
        appToast.success({ message: t('subscriptions.notificationsDisabledToast') })
      } else {
        // Включить уведомления (приватная подписка); подпишет, если ещё не подписан.
        await relations.subscribePrivate(address)
        appToast.success({ message: t('subscriptions.notificationsEnabledToast') })
      }
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
    }
  }

  // Гидрируем подписки/блок-лист, как только пользователь авторизован.
  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (authed) void relations.init()
    },
    { immediate: true }
  )

  return {
    isSubscribed,
    isSubscribedPrivate,
    isSubscribePending,
    isBlocked,
    isBlockPending,
    canShowSubscribe,
    isOwnProfile,
    onBlockClick,
    onPrimaryClick,
    onBellClick,
  }
}
