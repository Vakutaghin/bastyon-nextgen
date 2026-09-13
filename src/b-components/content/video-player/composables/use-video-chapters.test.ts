import { describe, it, expect } from 'vitest'
import { ref } from 'vue'

import type { Chapter } from '@/helpers/content/timecode-parser'
import { useVideoChapters } from './use-video-chapters'

const chapters: Chapter[] = [
  { start: 0, label: 'Intro' },
  { start: 30, label: 'Middle' },
  { start: 90, label: 'End' },
  { start: 500, label: 'Beyond' },
] as Chapter[]

describe('useVideoChapters', () => {
  it('маркеры: проценты для глав внутри длительности, без 0:00 и за пределами', () => {
    const duration = ref(120)
    const { chapterMarkers } = useVideoChapters(() => chapters, duration, ref(0))
    expect(chapterMarkers.value).toEqual([25, 75])
    duration.value = 0
    expect(chapterMarkers.value).toEqual([])
    duration.value = NaN
    expect(chapterMarkers.value).toEqual([])
  })

  it('активная глава следует за currentTime; без глав — null', () => {
    const currentTime = ref(0)
    const { activeChapter } = useVideoChapters(() => chapters, ref(120), currentTime)
    expect(activeChapter.value?.label).toBe('Intro')
    currentTime.value = 45
    expect(activeChapter.value?.label).toBe('Middle')
    currentTime.value = 100
    expect(activeChapter.value?.label).toBe('End')
    expect(useVideoChapters(() => undefined, ref(120), currentTime).activeChapter.value).toBeNull()
  })
})
