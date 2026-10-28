/**
 * Пер-аккаунтное состояние в памяти — одна точка сброса при входе, смене и
 * выходе (X9, V32). Раньше `switchAccount`/`signIn` не трогали relations
 * (гард `isInitialized`), pending-посты/комментарии/оценки, posts-store — и
 * аккаунт B видел подписки, блок-лист и pending-элементы A, а `poll()`
 * слал `getpagescores(postIds_A, B)`.
 *
 * Динамические импорты — сторы импортируют `useAuthStore`, статический импорт
 * замкнул бы цикл. Порядок фиксирован: сначала останавливаем то, что ходит в
 * сеть (pending-оценки, уведомления), потом чистим кэши.
 */

export async function resetAccountScopedStores(address?: string | null): Promise<void> {
  const [
    { usePendingRatingsStore },
    { useNotificationsStore },
    { useUserRelationsStore },
    { usePendingPostsStore },
    { useCommentsStore },
    { usePostsStore },
    { useSearchStore },
    { useNotificationSettingsStore },
    { usePaidSubscriptionsStore },
    { useCollectionsStore },
    { useMediaLibraryStore },
  ] = await Promise.all([
    import('@/stores/pending-ratings-store'),
    import('@/stores/notifications-store'),
    import('@/stores/user-relations-store'),
    import('@/stores/pending-posts-store'),
    import('@/stores/comments-store'),
    import('@/stores/posts-store'),
    import('@/stores/search-store'),
    import('@/stores/notification-settings-store'),
    import('@/stores/paid-subscriptions-store'),
    import('@/stores/collections-store'),
    import('@/stores/media-library-store'),
  ])
  usePendingRatingsStore().reset()
  useNotificationsStore().reset()
  useUserRelationsStore().reset()
  usePendingPostsStore().reset()
  // Посты нового аккаунта, ждущие блока, — с прошлого запуска (localStorage).
  usePendingPostsStore().init(address ?? null)
  useCommentsStore().reset()
  // Адаптированные посты несут per-user поля (`myVal`, liked/shared) — после
  // смены аккаунта их значения принадлежат прежнему пользователю.
  usePostsStore().clearPosts()
  // История поиска и фильтры уведомлений — per-account (N25/Р5): память чистим,
  // следующий ensureLoaded/load поднимет данные нового владельца.
  useSearchStore().reset()
  useNotificationSettingsStore().$reset()
  // Платежи за подписки и своя цена — данные аккаунта.
  usePaidSubscriptionsStore().reset()
  // Коллекции, ждущие блока, и личные списки видео и аудио — свои у аккаунта.
  useCollectionsStore().reset()
  useCollectionsStore().attach(address ?? null)
  useMediaLibraryStore().reset()
  if (address) useMediaLibraryStore().attach(address)
  // Блок-лист и подписки нового аккаунта — сразу: карточки ленты, стоящие на
  // экране, их не перезапросят, и до смены страницы лента показывала посты
  // заблокированных, а кнопки — чужие подписки.
  if (address) void useUserRelationsStore().init()
}
