/**
 * Обрезка текста для превью поста так, чтобы не разорвать ссылку.
 *
 * Карточка в ленте режет текст по числу символов, а ссылки расставляются уже
 * по обрезанному тексту. Если граница приходилась на середину URL, ссылка
 * получалась битой не только на вид: обрезанный кусок уезжал и в `href`, и
 * «скопировать адрес ссылки» отдавало огрызок.
 *
 * Поэтому граница сдвигается к началу той ссылки, которую она рассекает: в
 * превью лучше показать текст без последней ссылки, чем ссылку, ведущую в
 * никуда. Полный текст всё равно открывается по «показать полностью».
 */

import { createLinkRegex } from './text-formatter'

/**
 * Начало ссылки, которую рассекает граница `cut`, или `null`, если граница
 * проходит по обычному тексту.
 */
function linkBoundsAt(text: string, cut: number): { start: number; end: number } | null {
  const regex = createLinkRegex()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start >= cut) return null
    if (end > cut) return { start, end }
  }
  return null
}

/**
 * Обрезает текст до `maxLength`, никогда не разрывая ссылку, и добавляет
 * многоточие. Текст короче лимита возвращается как есть.
 */
export function truncateTextKeepingLinks(text: string, maxLength: number): string {
  if (maxLength <= 0) return text
  if (text.length <= maxLength) return text

  const bounds = linkBoundsAt(text, maxLength)
  let cut = maxLength

  if (bounds) {
    const head = text.slice(0, bounds.start).trimEnd()
    // Ссылка занимает всё начало превью — обрезать нечего, показываем её целиком,
    // иначе от превью осталось бы одно многоточие.
    cut = head.length > 0 ? bounds.start : bounds.end
  }

  const truncated = text.slice(0, cut).trimEnd()
  return truncated.length < text.length ? `${truncated}...` : truncated
}
