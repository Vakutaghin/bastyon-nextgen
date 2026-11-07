/**
 * «Поделиться в Bastyon» из мини-приложения: заготовка поста, как её собирал
 * прежний клиент (`getSocialsharePostParams`): заголовок и текст отдельными
 * строками, через пустую строку — ссылка на страницу приложения; картинки
 * приложения; к тегам — имя приложения.
 *
 * Раньше действие открывало ленту с `?share=…`, которую никто не читал, и
 * кнопка «Поделиться в Bastyon» в Barteron ничего не делала.
 */

import type { ComposerSharePrefill } from '@/b-components/content/post-composer/composer-source'
import { MAX_IMAGES, MAX_TAGS } from '@/b-components/content/post-composer/consts'

/** Длинный текст приложения режем: пост — не место для целой страницы. */
const MAX_TEXT = 2000
const MAX_TAG_LENGTH = 40

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function tagList(raw: unknown, appName: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    const tag = str(value).replace(/^#+/, '').slice(0, MAX_TAG_LENGTH)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) return
    seen.add(key)
    out.push(tag)
  }
  for (const tag of Array.isArray(raw) ? raw : []) add(tag)
  // Имя приложения — всегда: место для него освобождаем за счёт последних тегов.
  const app = str(appName)
  if (app && !seen.has(app.toLowerCase())) {
    out.splice(MAX_TAGS - 1)
    add(app)
  }
  return out.slice(0, MAX_TAGS)
}

export function sharePostPrefill(
  sharing: unknown,
  url: string,
  appName: string
): ComposerSharePrefill {
  const s = (sharing && typeof sharing === 'object' ? sharing : {}) as Record<string, unknown>
  const text = s.text && typeof s.text === 'object' ? (s.text as Record<string, unknown>) : {}
  const lines = [str(s.title), str(text.body)].filter(Boolean)
  let message = lines.join('\n').slice(0, MAX_TEXT)
  if (url) message = message ? `${message}\n\n${url}` : url

  const rawImages =
    typeof s.image === 'string' ? [s.image] : Array.isArray(s.images) ? s.images : []
  const images = rawImages
    .map(str)
    .filter((u) => /^https:\/\//i.test(u))
    .slice(0, MAX_IMAGES)

  return { message, images, tags: tagList(s.tags, appName) }
}
