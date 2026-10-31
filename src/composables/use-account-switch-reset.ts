/**
 * Смена аккаунта — переключение, вход в другой, регистрация второго, выход:
 * на экране не должно остаться ничего от прежнего. Страница грузит своё при
 * открытии — «Мои видео», кошелёк, настройки профиля, — и её кнопки
 * действовали бы ключами нового аккаунта над данными прежнего. Поэтому —
 * на ленту, а страница собирается заново (лента тоже: подписки и оценки у
 * каждого свои). Окна поста и композера закрываются по той же причине.
 *
 * Срабатывает, когда auth-store уже сбросил пер-аккаунтные сторы
 * (`accountEpoch`), — иначе новая страница успела бы загрузиться и попасть
 * под этот сброс. Вход гостя не трогаем: он входил, чтобы сделать что-то
 * здесь же.
 *
 * Возвращает ключ для `<router-view>`: он меняется, когда страницу пора
 * собрать заново.
 */

import { ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'

export function useAccountSwitchReset(): Ref<number> {
  const authStore = useAuthStore()
  const modalStore = useModalStore()
  const router = useRouter()
  const pageKey = ref(0)

  const current = (): string | null =>
    authStore.isUserAuthenticated ? authStore.getUserAddress : null

  /** Чьё сейчас на экране. */
  let shown = current()
  watch(current, (address) => {
    if (!shown) shown = address
  })

  watch(
    () => authStore.accountEpoch,
    () => {
      const before = shown
      shown = current()
      if (!before || before === shown) return

      if (modalStore.postModal.isOpen) modalStore.closePostModal({ restoreScroll: false })
      if (modalStore.postComposerModal.isOpen) modalStore.closePostComposerModal()
      if (modalStore.imageGallery.isOpen) modalStore.closeImageGallery()

      pageKey.value++
      if (router.currentRoute.value.name !== 'home') void router.replace({ name: 'home' })
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  )

  return pageKey
}
