// Картинки статьи (Editor.js) открываются в просмотрщике приложения — все
// картинки статьи по порядку, с той, на которую нажали. Своего увеличения у
// них не было, а пункт «Увеличить изображение (Ctrl + двойной щелчок)» из
// контекстного меню WebView2 на Windows в приложении не работает.

import type { InjectionKey } from 'vue'

export interface ArticleImageData {
  url?: string
  src?: string
  file?: { url?: string }
}

/** Адрес картинки блока: у разных редакторов он в разных полях. */
export function articleImageUrl(data: ArticleImageData | undefined): string {
  return data?.url || data?.file?.url || data?.src || ''
}

/** Открыть картинку статьи в просмотрщике (block-content даёт, block-image зовёт). */
export const OPEN_ARTICLE_IMAGE: InjectionKey<(url: string) => void> = Symbol('openArticleImage')
