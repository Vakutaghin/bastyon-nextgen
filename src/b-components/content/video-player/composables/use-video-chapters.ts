// Главы (тайм-коды из описания): маркеры на прогресс-баре и активная глава по
// текущему времени. Чистая производная от chapters/duration/currentTime —
// единственный кусок оркестрации video-player.vue, который стоило выносить.
import { computed, type Ref } from 'vue'
import { findActiveChapterIndex, type Chapter } from '@/helpers/content/timecode-parser'

export function useVideoChapters(
  chapters: () => Chapter[] | undefined,
  duration: Ref<number>,
  currentTime: Ref<number>
) {
  // Маркеры на прогресс-баре (в процентах); пропускаем 0:00 и тайм-коды
  // за пределами длительности.
  const chapterMarkers = computed<number[]>(() => {
    const list = chapters() || []
    const total = duration.value
    if (!list.length || !total || !isFinite(total) || total <= 0) return []
    return list
      .filter((ch) => ch.start > 0 && ch.start < total)
      .map((ch) => (ch.start / total) * 100)
  })

  // Текущая активная глава по currentTime (показывается рядом со временем).
  const activeChapter = computed<Chapter | null>(() => {
    const list = chapters() || []
    if (!list.length) return null
    const idx = findActiveChapterIndex(list, currentTime.value)
    return idx >= 0 ? (list[idx] ?? null) : null
  })

  return { chapterMarkers, activeChapter }
}
