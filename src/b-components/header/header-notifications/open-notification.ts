// Переход по уведомлению — из списка, всплывающего и системного уведомления.
// Куда — решает notificationTarget; здесь догрузка нужного и сам переход.

import type { Router } from 'vue-router'
import { useNotificationsStore } from '@/stores'
import { useModalStore } from '@/stores/modal-store'
import type { NotificationItem } from '@/stores/notifications-store'
import { notificationTarget, type NotificationTarget } from '@/stores/notification-target'
import { adaptPostData } from '@/helpers/common/adapt-post'
import { openExternal } from '@/helpers/common/open-external'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { classifyNotificationLink } from './helpers/notification-link'

export interface OpenNotificationOptions {
  router: Router
  /** Сразу открыть форму ответа на комментарий («Ответить»). */
  reply?: boolean
  /** Перед самим переходом — закрыть список: пока догружается, он остаётся. */
  onLeave?: () => void
}

/**
 * Ведёт туда, о чём уведомление: к комментарию в окне поста, к посту, в
 * профиль, кошелёк. Чего не хватает — комментария, поста — догружает и
 * только потом уходит. Комментария на ноде нет (удалён) — сообщает и
 * остаётся на месте, а не уводит в профиль, как раньше.
 */
export async function openNotification(
  item: NotificationItem,
  { router, reply = false, onLeave }: OpenNotificationOptions
): Promise<void> {
  const store = useNotificationsStore()
  let target = notificationTarget(item, store.getEnrichment(item).comment)
  if (target.kind === 'comment') {
    await store.ensureComment(target.commentId)
    target = notificationTarget(item, store.getEnrichment(item).comment)
    if (target.kind === 'comment') {
      appToast.error({ message: t('header.commentNotFound') })
      return
    }
  }

  switch (target.kind) {
    case 'post':
      await openPost(target, reply, router, onLeave)
      return
    case 'profile':
      onLeave?.()
      void router.push(`/${target.address}`)
      return
    case 'wallet':
      onLeave?.()
      void router.push({ name: 'wallets' })
      return
    case 'paidSubscribers':
      onLeave?.()
      void router.push({ name: 'paid-subscriptions', query: { tab: 'subscribers' } })
      return
    case 'link':
      onLeave?.()
      openLink(target.link, router)
      return
    case 'none':
      return
  }
}

/**
 * Пост — в окне поверх страницы, с переходом к комментарию. Нода поста не
 * отдала — страница поста: она сама покажет загрузку, «не найден» или ошибку.
 */
async function openPost(
  target: Extract<NotificationTarget, { kind: 'post' }>,
  reply: boolean,
  router: Router,
  onLeave: (() => void) | undefined
): Promise<void> {
  const store = useNotificationsStore()
  const comment = target.commentId
    ? { commentId: target.commentId, parentId: target.parentId, reply }
    : undefined
  if (await store.ensurePost(target.postId)) {
    try {
      const adapted = adaptPostData(store.postCache[target.postId] as never, 0)
      onLeave?.()
      useModalStore().openPostModal(adapted as never, { target: comment })
      return
    } catch (err) {
      console.warn('[notifications] adapt post failed', err)
    }
  }
  onLeave?.()
  void router.push({
    name: 'post',
    params: { txid: target.postId },
    query: comment
      ? {
          commentid: comment.commentId,
          ...(comment.parentId ? { parentid: comment.parentId } : {}),
        }
      : {},
    ...(comment && reply ? { state: { reply: true } } : {}),
  })
}

/**
 * Безопасно открывает `item.link` (P1-5, open-redirect guard). Решение — в
 * чистом `classifyNotificationLink`, здесь только исполнение.
 */
function openLink(link: string, router: Router): void {
  const action = classifyNotificationLink(link)
  switch (action.kind) {
    case 'same-tab':
      window.location.href = action.href
      break
    case 'new-tab':
      // Общий openExternal: в десктопной сборке window.open ничего не делает (V40).
      void openExternal(action.href)
      break
    case 'router':
      void router.push(action.path)
      break
    case 'ignore':
      break
  }
}
