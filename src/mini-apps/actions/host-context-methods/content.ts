/**
 * HostContext methods: открытие постов/профилей/доната, шаринг, complain.
 *
 * «Поделиться в Bastyon» открывает окно поста с заготовкой (share-post.ts),
 * жалоба — окно жалобы (complain-dialog-controller), как у прежнего клиента.
 */

import type { Router } from 'vue-router'
import { openExternal } from '@/helpers/common/open-external'
import {
  publicFromAppLink,
  publicMiniAppUrl,
  publicShareOrigin,
} from '@/helpers/common/share-origin'
import type { HostContext } from '../host-context'
import type { ComposerSharePrefill } from '@/b-components/content/post-composer/composer-source'
import { complaintEntity } from '../../core/miniapp-complaint'
import type { ComplainRequest } from '../../ui/complain-dialog-controller'
import { sharePostPrefill } from './share-post'

export interface ContentDeps {
  router: Router
  /** Окно поста с заготовкой (на телефоне — страница /compose). */
  openComposer: (share: ComposerSharePrefill) => Promise<void>
  /** Окно жалобы; true — жалоба ушла. */
  complain: (req: ComplainRequest, signal?: AbortSignal) => Promise<boolean>
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
      // SDK без init() отдаёт в url голый путь (`get.applink` не знает приложения):
      // такой путь — страница этого приложения.
      const isLink = !!data.url && /^[a-z][a-z0-9+.-]*:\/\//i.test(data.url)
      const path = isLink ? undefined : (data.url ?? data.path)
      const url = isLink
        ? publicFromAppLink(data.url!)
        : sharePref.appId
          ? publicMiniAppUrl(sharePref.appId, path)
          : publicShareOrigin()

      if (sharePref.onBastyon) {
        // Окно поста с текстом, картинками и ссылкой приложения.
        await deps.openComposer(sharePostPrefill(data.sharing, url, sharePref.appName ?? ''))
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

    openComplain: async (data, appName = '', signal) => {
      const entity = complaintEntity(data)
      if (!entity) throw new Error('complain:invalid')
      // Отвечаем, когда окно закрыли, — ушла жалоба или нет (прежний клиент
      // отвечал сразу и ничем).
      await deps.complain({ appName, entity }, signal)
    },
  }
}
