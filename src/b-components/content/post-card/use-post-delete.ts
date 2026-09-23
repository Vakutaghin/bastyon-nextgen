// Удаление своего поста из карточки: подтверждение → contentDelete-транзакция
// (post-deleter) → тост и колбэк владельцу. Вынесено из post-card.vue, чтобы
// tx-побочный эффект был тестируем отдельно от шаблона.

import { ref } from 'vue'
import { Modal } from 'ant-design-vue'

import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'

import { usePostsStore } from '@/stores/posts-store'

import { deletePost } from './post-deleter'

export function usePostDelete(getPostId: () => string, onDeleted: (postId: string) => void) {
  const deleting = ref(false)
  const deleted = ref(false)

  async function doDelete(): Promise<void> {
    if (deleting.value) return
    deleting.value = true
    try {
      const postId = getPostId()
      await deletePost(postId)
      deleted.value = true
      // Прячем пост везде, а не только в этой карточке: `emit('deleted')`
      // никто не слушал, и он продолжал висеть в ленте и модалке (N12).
      usePostsStore().markDeleted(postId)
      appToast.success({ message: t('postCard.deleted') })
      onDeleted(postId)
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('postCard.deleteFailed') })
    } finally {
      deleting.value = false
    }
  }

  function confirmDelete(): void {
    Modal.confirm({
      title: t('postCard.deleteConfirmTitle'),
      content: t('postCard.deleteConfirmText'),
      okText: t('postCard.deleteAction'),
      okType: 'danger',
      cancelText: t('postCard.deleteCancel'),
      onOk: doDelete,
    })
  }

  return { deleting, deleted, confirmDelete, doDelete }
}
