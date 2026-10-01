/**
 * «Создать пост» с уже загруженным видео: на телефоне — страница /compose во
 * весь экран, на компьютере — окно редактора поверх страницы (как у кнопки
 * над лентой). Видео прикреплено, его название — заголовок поста.
 */

import { useRouter } from 'vue-router'

import { isMobile } from '@mobile/utils/platform'
import { useModalStore } from '@/stores/modal-store'
import type { ComposerVideoPrefill } from '@/b-components/content/post-composer/composer-source'

export function useOpenComposerWithVideo(): (video: ComposerVideoPrefill) => void {
  const router = useRouter()
  const modalStore = useModalStore()
  return (video) => {
    if (isMobile()) {
      modalStore.postComposerModal.video = video
      void router.push({ name: 'compose' })
      return
    }
    modalStore.openPostComposerModal({ video })
  }
}
