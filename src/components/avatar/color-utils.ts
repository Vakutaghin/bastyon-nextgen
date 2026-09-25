/**
 * Цвет аватара без фото: у каждого пользователя свой оттенок (по адресу или
 * имени), но не свой «пастельный кружок», одинаковый в обеих темах, а подложка
 * этого оттенка с прозрачностью и инициалы тем же оттенком — как у UAvatar в
 * Nuxt UI. Подложка ложится на фон страницы, поэтому работает и в тёмной теме.
 */

/** Оттенок (0–359) для строки; без строки — случайный. */
export function avatarHue(seed?: string): number {
  let hash = 0
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash)
    }
  } else {
    hash = Math.random() * 1000000
  }
  return Math.abs(hash) % 360
}

/** Полупрозрачная подложка оттенка пользователя. */
export function avatarFallbackBackground(hue: number): string {
  return `hsl(${hue} 65% 55% / 0.18)`
}

/** Инициалы тем же оттенком; светлоту задаёт тема (`--ui-avatar-text-l`). */
export function avatarFallbackText(hue: number): string {
  return `hsl(${hue} 50% var(--ui-avatar-text-l))`
}
