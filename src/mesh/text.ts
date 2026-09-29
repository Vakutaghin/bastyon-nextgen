/**
 * Длина текста в mesh-сетях считается в байтах UTF-8: у MeshCore 160 байт на
 * сообщение, и кириллица занимает по 2 байта на букву. Длинный текст уходит
 * несколькими сообщениями с пометкой «(1/3)» — так советует протокол.
 */

import { truncateUtf8, utf8Length } from './bytes'

/** «(9/9) » — 6 байт на пометку части. */
const PART_MARK_BYTES = 6

/**
 * Части текста, каждая не длиннее `maxBytes` байт вместе с пометкой.
 * Режем по пробелу, если он не слишком далеко от конца куска, иначе — по
 * границе символа. `null` — больше `maxParts` частей: слишком длинно для эфира.
 */
export function splitForMesh(text: string, maxBytes: number, maxParts = 5): string[] | null {
  const clean = text.trim()
  if (!clean) return []
  if (utf8Length(clean) <= maxBytes) return [clean]
  const bodyLimit = maxBytes - PART_MARK_BYTES
  if (bodyLimit <= 0) return null
  const parts: string[] = []
  let rest = clean
  while (rest.length > 0) {
    if (parts.length === maxParts) return null
    let piece = truncateUtf8(rest, bodyLimit)
    if (piece.length < rest.length) {
      const space = piece.lastIndexOf(' ')
      if (space > piece.length / 2) piece = piece.slice(0, space)
    }
    parts.push(piece.trim())
    rest = rest.slice(piece.length).trimStart()
  }
  return parts.map((p, i) => `(${i + 1}/${parts.length}) ${p}`)
}

/** Сколько байт осталось до предела (для счётчика в поле ввода). */
export function bytesLeft(text: string, maxBytes: number): number {
  return maxBytes - utf8Length(text.trim())
}
