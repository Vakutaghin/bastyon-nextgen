// Действия отношений на сайдбаре профиля: подписка/уведомления (bell)/блокировка
// с тостами, плюс gating (canShowSubscribe/isOwnProfile). Гидрирует relations при
// авторизации. Вынесено из profile-sidebar.vue (аудит крупных файлов 2026-08).
import { computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import { useRelationActions } from '@/composables/use-relation-actions'

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
  /** Подписки ещё не пришли с ноды — кнопка ждёт, а не зовёт «Подписаться». */
  const isSubscriptionUnknown = computed<boolean>(
    () => !relations.isSubscriptionKnown(userAddress.value)
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

  // Отписка и (раз)блокировка — транзакции: переспрашиваем, как старый клиент.
  const { toggleBlock, toggleFollow } = useRelationActions()

  function onBlockClick(): void {
    if (!isBlockPending.value) toggleBlock(userAddress.value)
  }

  async function onPrimaryClick(): Promise<void> {
    await toggleFollow(userAddress.value)
  }

  async function onBellClick(): Promise<void> {
    const address = userAddress.value
    if (!address || isSubscribePending.value || isSubscriptionUnknown.value) return
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
    isSubscriptionUnknown,
    isBlocked,
    isBlockPending,
    canShowSubscribe,
    isOwnProfile,
    onBlockClick,
    onPrimaryClick,
    onBellClick,
  }
}
