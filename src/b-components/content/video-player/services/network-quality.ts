/**
 * Network-aware потолок стартового качества. На медленной сети / в режиме экономии
 * трафика стартуем HLS с низкого уровня, чтобы первый кадр появился быстрее
 * (метрика приёмки: first frame <8s на 3G), вместо «качаем 1080p по 3G».
 *
 * Источник сигнала — Network Information API (`navigator.connection`). Он есть не во
 * всех браузерах (нет в Safari), поэтому всё опционально: нет данных → не ограничиваем.
 */

import type Hls from 'hls.js'

/** Минимальная форма NetworkInformation, которую читаем (всё опционально). */
export interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Максимальная высота видео (px), разумная для текущей сети. `null` — без ограничения.
 *
 * - Save-Data (явный запрос экономии) → 480p
 * - slow-2g / 2g → 240p
 * - 3g → 480p
 * - 4g / неизвестно / нет API → без ограничения (`null`)
 */
export function getNetworkMaxHeight(
  conn: NetworkInformationLike | undefined | null
): number | null {
  if (!conn) return null
  if (conn.saveData) return 480
  switch (conn.effectiveType) {
    case 'slow-2g':
    case '2g':
      return 240
    case '3g':
      return 480
    default:
      return null
  }
}

/** Читает `navigator.connection` (с вендорными префиксами) — undefined, если API нет. */
function readConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike
    mozConnection?: NetworkInformationLike
    webkitConnection?: NetworkInformationLike
  }
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

/**
 * Скорость сети по последнему ролику (бит/с). С неё начинает следующий: без
 * неё hls.js для каждого ролика заново предполагал 500 кбит/с, и на медленной
 * сети каждый начинался с 360p, которых она не тянет. Живёт до перезапуска —
 * сеть за это время могла смениться.
 */
let lastBandwidth: number | null = null

export function rememberBandwidth(bitsPerSecond: number): void {
  if (Number.isFinite(bitsPerSecond) && bitsPerSecond > 0) lastBandwidth = bitsPerSecond
}

/** С какой скорости начинать; `null` — ещё не мерили. */
export function knownBandwidth(): number | null {
  return lastBandwidth
}

/** Для тестов. */
export function forgetBandwidthForTests(): void {
  lastBandwidth = null
}

/**
 * Ограничивает ABR hls.js потолком качества под текущую сеть. Зовётся после
 * MANIFEST_PARSED (когда `hls.levels` уже заполнены). Не трогает ручной выбор
 * качества пользователем — только верхнюю границу авто-режима (`autoLevelCapping`).
 */
export function applyNetworkQualityCap(hls: Hls): void {
  const maxHeight = getNetworkMaxHeight(readConnection())
  const levels = hls.levels
  if (maxHeight === null || !levels || levels.length === 0) return

  // Индекс наибольшего уровня с height ≤ maxHeight.
  let capIndex = -1
  levels.forEach((level, i) => {
    const h = level.height || 0
    if (h > 0 && h <= maxHeight && (capIndex === -1 || h > (levels[capIndex].height || 0))) {
      capIndex = i
    }
  })

  // Все уровни выше потолка → берём самый низкий доступный.
  if (capIndex === -1) {
    capIndex = levels.reduce(
      (min, level, i) => ((level.height || 0) < (levels[min].height || 0) ? i : min),
      0
    )
  }

  hls.autoLevelCapping = capIndex
}
