/**
 * HostContext methods: открытие постов/профилей/доната, шаринг, complain.
 */

import type { Router } from 'vue-router'
import { openExternal } from '@/helpers/common/open-external'
import {
  publicFromAppLink,
  publicMiniAppUrl,
  publicShareOrigin,
} from '@/helpers/common/share-origin'
import type { HostContext } from '../host-context'

export interface ContentDeps {
  router: Router
}

export type ContentMethods = Pick<
  HostContext,
  'openPost' | 'openDonation' | 'openExternalLink' | 'share' | 'openComplain'
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
      // Системный браузер в Tauri, новая вкладка в вебе. Прямой `window.open`
      // на десктопе не работал вовсе (V40).
      await openExternal(url)
    },

    share: async (data, sharePref = {}) => {
      // Ссылка уходит другому человеку — только публичный адрес. Раньше путь
      // приклеивался к своему origin, и из приложения уходило
      // http://tauri.localhost/… или https://localhost/…
      const url = data.url
        ? publicFromAppLink(data.url)
        : sharePref.appId
          ? publicMiniAppUrl(sharePref.appId, data.path)
          : publicShareOrigin()

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
      // Старый клиент такую жалобу только писал в свою телеметрию
      // (Logger.info MINIAPP_COMPLAIN) — ни транзакции, ни модерации. Телеметрии
      // здесь нет намеренно, поэтому честно отвечаем «не поддерживается»:
      // раньше мини-аппа получала успех и говорила человеку «жалоба отправлена».
      throw new Error('complain:notsupported')
    },
  }
}
