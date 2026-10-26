/**
 * Подписка, отписка, блокировка и разблокировка человека — с подтверждением и
 * тостами. Одно место для профиля, шапки поста, меню поста, списков людей и
 * «Чёрного списка». Комментарии держат свою копию блокировки в
 * use-comment-edit-delete (там ещё отклик вибрацией).
 *
 * Всё это транзакции в блокчейне. Как и старый клиент, переспрашиваем перед
 * отпиской и (раз)блокировкой: случайное нажатие стоит записи в цепочку.
 */

import { h } from 'vue'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useUserRelationsStore } from '@/stores'
import { t } from '@/i18n'
import { Z_INDEX } from '@/styles/design-tokens'

interface ConfirmOptions {
  title: string
  content?: string
  okText: string
  danger?: boolean
  onOk: () => Promise<void>
}

function confirm(opts: ConfirmOptions): void {
  Modal.confirm({
    title: opts.title,
    icon: h(ExclamationCircleOutlined),
    content: opts.content,
    okText: opts.okText,
    okType: opts.danger ? 'danger' : 'primary',
    cancelText: t('commentsMsg.cancel'),
    centered: true,
    zIndex: Z_INDEX.CONFIRM,
    onOk: opts.onOk,
  })
}

/** Выполняет действие отношений и сообщает итог тостом. */
async function run(action: () => Promise<void>, success: string, failure: string): Promise<void> {
  try {
    await action()
    appToast.success({ message: success })
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : failure })
  }
}

export function useRelationActions() {
  const relations = useUserRelationsStore()

  function block(address: string): Promise<void> {
    return run(
      () => relations.block(address),
      t('commentsMsg.blockSuccess'),
      t('commentsMsg.blockError')
    )
  }

  function unblock(address: string): Promise<void> {
    return run(
      () => relations.unblock(address),
      t('commentsMsg.unblockSuccess'),
      t('commentsMsg.unblockError')
    )
  }

  /** «Заблокировать пользователя?» → блокировка. */
  function confirmBlock(address: string): void {
    if (!address || relations.isPending(address)) return
    confirm({
      title: t('commentsMsg.blockConfirmTitle'),
      content: t('commentsMsg.blockConfirmContent'),
      okText: t('commentsMsg.blockConfirmOk'),
      danger: true,
      onOk: () => block(address),
    })
  }

  /** «Разблокировать пользователя?» → разблокировка. */
  function confirmUnblock(address: string): void {
    if (!address || relations.isPending(address)) return
    confirm({
      title: t('commentsMsg.unblockConfirmTitle'),
      content: t('commentsMsg.unblockConfirmContent'),
      okText: t('commentsMsg.unblockConfirmOk'),
      onOk: () => unblock(address),
    })
  }

  /** Заблокирован — переспросить о разблокировке, иначе о блокировке. */
  function toggleBlock(address: string): void {
    if (relations.isBlocked(address)) confirmUnblock(address)
    else confirmBlock(address)
  }

  /** Не подписан — подписаться сразу; подписан — переспросить и отписаться. */
  async function toggleFollow(address: string): Promise<void> {
    if (!address || relations.isSubscribePending(address)) return
    if (!relations.isSubscribed(address)) {
      await run(
        () => relations.subscribe(address),
        t('subscriptions.subscribedToast'),
        t('subscriptions.errFailed')
      )
      return
    }
    confirm({
      title: t('subscriptions.unsubscribeConfirmTitle'),
      okText: t('subscriptions.unsubscribeConfirmOk'),
      onOk: () =>
        run(
          () => relations.unsubscribe(address),
          t('subscriptions.unsubscribedToast'),
          t('subscriptions.errFailed')
        ),
    })
  }

  return { block, unblock, confirmBlock, confirmUnblock, toggleBlock, toggleFollow }
}
