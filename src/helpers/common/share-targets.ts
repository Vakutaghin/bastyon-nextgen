/**
 * Цели внешнего шаринга (legacy `socialshare2`). Стандартные web-intent URL —
 * открываются в новой вкладке. Иконки — из @ant-design/icons-vue.
 */

import type { Component } from 'vue'
import {
  SendOutlined,
  TwitterOutlined,
  FacebookOutlined,
  RedditOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons-vue'

export interface ShareTarget {
  key: string
  /** Человекочитаемое имя (бренды не переводим). */
  label: string
  icon: Component
  /** Фирменный цвет иконки. */
  color: string
  /** Строит URL шаринга по ссылке на пост и тексту. */
  buildUrl: (url: string, text: string) => string
}

const enc = encodeURIComponent

export const SHARE_TARGETS: ShareTarget[] = [
  {
    key: 'telegram',
    label: 'Telegram',
    icon: SendOutlined,
    color: '#0088cc',
    buildUrl: (url, text) => `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    icon: TwitterOutlined,
    color: '#1da1f2',
    buildUrl: (url, text) => `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: FacebookOutlined,
    color: '#3b5998',
    buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    icon: RedditOutlined,
    color: '#ff5700',
    buildUrl: (url, text) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsAppOutlined,
    color: '#25d366',
    buildUrl: (url, text) => `https://api.whatsapp.com/send?text=${enc(`${text} ${url}`)}`,
  },
]
