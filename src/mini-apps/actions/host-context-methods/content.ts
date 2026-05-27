/**
 * HostContext methods: открытие постов/профилей/доната, шаринг, complain,
 * pending actions.
 */

import type { Router } from 'vue-router'
import type { HostContext } from '../host-context'

export interface ContentDeps {
  router: Router
}

export type ContentMethods = Pick<
  HostContext,
  'openPost' | 'openDonation' | 'openExternalLink' | 'share' | 'openComplain' | 'getPendingActions'
>

export function createContentMethods(deps: ContentDeps): ContentMethods {
  const { router } = deps

  return {
    openPost: async (txid) => {
      // Legacy открывает modal с постом. У нас в nextgen post-modal через ?p=<txid>.
      void router.push({ path: '/', query: { p: txid } })
    },

    openDonation: async (receiver) => {
      // Открываем профиль получателя — оттуда уже доступна донат-кнопка.
      void router.push(`/${receiver}`)
    },

    openExternalLink: async (url) => {
      // В Tauri/Capacitor желательно открывать в системном браузере, но `window.open`
      // в обоих окружениях обычно делегируется правильно.
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },

    share: async (data, sharePref = {}) => {
      const url =
        data.url ??
        (data.path
          ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${data.path.replace(/^\/+/, '')}`
          : typeof window !== 'undefined'
            ? window.location.href
            : '')

      if (sharePref.onBastyon) {
        // Внутренний шаринг: открываем форму создания поста с pre-fill.
        void router.push({ path: '/', query: { share: url } })
        return
      }

      // Web Share API если есть, иначе fallback на копирование в clipboard.
      const nav = typeof navigator !== 'undefined' ? navigator : undefined
      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({ url })
          return
        } catch {
          // ignored — пользователь отменил или Web Share не поддерживается
        }
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url)
      }
    },

    openComplain: async (_data) => {
      // TODO(etap 7+): подключить complain modal. Сейчас игнорим silently —
      // миниаппа получает успех, пользовательский UI отсутствует.
    },

    getPendingActions: () => {
      // Legacy: pending actions = транзакции в mempool. Pending tx store
      // ещё не подключён к миниаппам в nextgen.
      return []
    },
  }
}
