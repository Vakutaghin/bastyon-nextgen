/**
 * Разделы и действия, которым нужен аккаунт. Гостя раньше молча уводило на
 * ленту (кошелёк, настройки, мои видео) или открывало мессенджер, который без
 * входа не запускается и вечно «подключается». Теперь гость видит окно входа,
 * а после входа выполняется то, что он хотел: открывается раздел, чаты,
 * вкладка «Подписки».
 */
import { effectScope, watch } from 'vue'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'

let pending: (() => void) | null = null
let started = false

function start(): void {
  if (started) return
  started = true
  const authStore = useAuthStore()
  const modalStore = useModalStore()
  // Своя область: наблюдатели живут всё время работы приложения, а не вместе
  // с компонентом, который первым позвал requireAuth.
  effectScope(true).run(() => {
    watch(
      () => authStore.isUserAuthenticated,
      (signedIn) => {
        if (!signedIn || !pending) return
        const action = pending
        pending = null
        action()
      }
    )
    // Окно закрыли, так и не войдя, — отложенное действие больше не нужно.
    watch(
      () => modalStore.authModal.isOpen,
      (open) => {
        if (!open && !authStore.isUserAuthenticated) pending = null
      }
    )
  })
}

/**
 * Выполняет действие сразу, если вход выполнен. Иначе открывает окно входа и
 * выполняет действие после входа. Возвращает, выполнено ли оно сейчас.
 */
export function requireAuth(action: () => void): boolean {
  start()
  if (useAuthStore().isUserAuthenticated) {
    action()
    return true
  }
  pending = action
  useModalStore().openAuthModal('login')
  return false
}
