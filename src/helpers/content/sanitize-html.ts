/**
 * Санитизация HTML контента постов/комментариев перед рендером через v-html.
 *
 * Контент (`m`-поле) приходит из блокчейна — это НЕДОВЕРЕННЫЙ ввод. Посты Bastyon
 * содержат инлайн-разметку (`<b>`, `<i>`, `<br>`, `&nbsp;`, ссылки, списки и т.п.),
 * которую надо рендерить, но без XSS. Используем библиотеку `xss` с whitelist —
 * как в оригинале pocketnet.gui (там `xss()` с `whiteList`).
 *
 * Неразрешённые теги ЭКРАНИРУЮТСЯ (поведение xss по умолчанию: показываются как
 * текст, а не вырезаются), `<script>`/`<style>` удаляются вместе с содержимым,
 * inline-стили (`style=`) и `javascript:`-протоколы вырезаются. Дополнительно
 * разрешаем `bastyon://` в href (внутренние ссылки) и `data-seconds` на ссылках
 * (тайм-коды видео) — наши собственные кликабельные элементы.
 */

import { FilterXSS, safeAttrValue } from 'xss'

/** Разрешённые теги и атрибуты для контента постов/комментариев. */
const WHITE_LIST = {
  a: ['href', 'title', 'target', 'rel', 'class', 'data-seconds', 'data-address'],
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  s: [],
  strike: [],
  del: [],
  ins: [],
  mark: [],
  sub: [],
  sup: [],
  br: [],
  hr: ['class'],
  p: ['class'],
  div: ['class'],
  span: ['class'],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  ul: [],
  ol: ['start'],
  li: [],
  blockquote: ['class'],
  cite: [],
  footer: ['class'],
  code: ['class'],
  pre: ['class'],
  img: ['src', 'alt', 'title', 'class'],
  figure: ['class'],
  figcaption: ['class'],
  table: ['class'],
  thead: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
}

const filter = new FilterXSS({
  whiteList: WHITE_LIST,
  // Удаляем <script>/<style> целиком (с телом). Остальные неразрешённые теги
  // экранируются (показываются как текст), а не вырезаются.
  stripIgnoreTagBody: ['script', 'style'],
  // Inline CSS запрещён.
  css: false,
  safeAttrValue(tag, name, value, cssFilter) {
    // bastyon:// — наш внутренний протокол ссылок; xss по умолчанию его вырезает.
    if (tag === 'a' && name === 'href' && /^bastyon:\/\//i.test(value)) {
      return value
    }
    return safeAttrValue(tag, name, value, cssFilter)
  },
})

/** Санитизирует HTML-строку, оставляя только whitelist-теги/атрибуты. */
export function sanitizeHtml(html: string): string {
  return html && typeof html === 'string' ? filter.process(html) : ''
}
