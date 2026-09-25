/**
 * Логотипы соцсетей для меню «Поделиться» — из Simple Icons (в Lucide брендов
 * нет). Рисуются как остальные иконки из ./index.ts: `<span class="anticon">`
 * с svg размером 1em, цвет — currentColor.
 */

import { h, type FunctionalComponent } from 'vue'
import { siFacebook, siReddit, siTelegram, siWhatsapp, siX, type SimpleIcon } from 'simple-icons'

function brandIcon(name: string, icon: SimpleIcon): FunctionalComponent {
  const Wrapped: FunctionalComponent = (_, { attrs }) =>
    h(
      'span',
      {
        role: 'img',
        'aria-hidden': 'true',
        ...attrs,
        class: ['anticon', 'ui-icon', attrs.class],
      },
      [
        h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'currentColor' }, [
          h('path', { d: icon.path }),
        ]),
      ]
    )
  Wrapped.displayName = name
  Wrapped.inheritAttrs = false
  return Wrapped
}

export const TelegramLogo = brandIcon('TelegramLogo', siTelegram)
export const XLogo = brandIcon('XLogo', siX)
export const FacebookLogo = brandIcon('FacebookLogo', siFacebook)
export const RedditLogo = brandIcon('RedditLogo', siReddit)
export const WhatsAppLogo = brandIcon('WhatsAppLogo', siWhatsapp)

/** Фирменные цвета — из тех же данных Simple Icons. */
export const BRAND_COLORS = {
  telegram: `#${siTelegram.hex}`,
  facebook: `#${siFacebook.hex}`,
  reddit: `#${siReddit.hex}`,
  whatsapp: `#${siWhatsapp.hex}`,
} as const
