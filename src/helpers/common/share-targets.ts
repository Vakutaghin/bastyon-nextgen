/**
 * Цели внешнего шаринга (legacy `socialshare2`). Стандартные web-intent URL —
 * открываются в новой вкладке. Логотипы — из Simple Icons.
 */

import type { Component } from 'vue'
import {
  BRAND_COLORS,
  FacebookLogo,
  RedditLogo,
  TelegramLogo,
  WhatsAppLogo,
  XLogo,
} from '@/components/icons/brands'

export interface ShareTarget {
  key: string
  /** Человекочитаемое имя (бренды не переводим). */
  label: string
  icon: Component
  /** Фирменный цвет иконки; currentColor — цветом текста. */
  color: string
  /** Строит URL шаринга по ссылке на пост и тексту. */
  buildUrl: (url: string, text: string) => string
}

const enc = encodeURIComponent

export const SHARE_TARGETS: ShareTarget[] = [
  {
    key: 'telegram',
    label: 'Telegram',
    icon: TelegramLogo,
    color: BRAND_COLORS.telegram,
    buildUrl: (url, text) => `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    icon: XLogo,
    // Логотип X одноцветный: чёрный в светлой теме, белый в тёмной.
    color: 'currentColor',
    buildUrl: (url, text) => `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: FacebookLogo,
    color: BRAND_COLORS.facebook,
    buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    icon: RedditLogo,
    color: BRAND_COLORS.reddit,
    buildUrl: (url, text) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsAppLogo,
    color: BRAND_COLORS.whatsapp,
    buildUrl: (url, text) => `https://api.whatsapp.com/send?text=${enc(`${text} ${url}`)}`,
  },
]
