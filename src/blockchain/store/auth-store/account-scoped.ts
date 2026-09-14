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

export async function resetAccountScopedStores(): Promise<void> {
  const [
    { usePendingRatingsStore },
    { useNotificationsStore },
    { useUserRelationsStore },
    { usePendingPostsStore },
    { useCommentsStore },
    { usePostsStore },
  ] = await Promise.all([
    import('@/stores/pending-ratings-store'),
    import('@/stores/notifications-store'),
    import('@/stores/user-relations-store'),
    import('@/stores/pending-posts-store'),
    import('@/stores/comments-store'),
    import('@/stores/posts-store'),
  ])
  usePendingRatingsStore().reset()
  useNotificationsStore().reset()
  useUserRelationsStore().reset()
  usePendingPostsStore().reset()
  useCommentsStore().reset()
  // Адаптированные посты несут per-user поля (`myVal`, liked/shared) — после
  // смены аккаунта их значения принадлежат прежнему пользователю.
  usePostsStore().clearPosts()
}
