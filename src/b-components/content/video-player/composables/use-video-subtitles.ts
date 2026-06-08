/**
 * Субтитры для PeerTube-видео. Парсит host/videoId из `peertube://…` URL, тянет
 * список субтитров (`/api/v1/videos/{id}/captions`), фетчит каждый VTT и отдаёт
 * его как blob-URL — так `<track>` не зависит от CORS/crossorigin исходного хоста.
 * Если субтитров нет — просто пустой список (видео работает как раньше).
 */

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { getPeerTubeCaptions } from '@/helpers/api/peertube-api'

export interface SubtitleTrack {
  language: string
  label: string
  /** blob: URL с содержимым VTT. */
  src: string
}

export function useVideoSubtitles(videoUrl: Ref<string | undefined>) {
  const tracks = ref<SubtitleTrack[]>([])
  let token = 0

  function revoke(): void {
    for (const t of tracks.value) {
      try {
        URL.revokeObjectURL(t.src)
      } catch {
        /* noop */
      }
    }
    tracks.value = []
  }

  async function load(url: string | undefined): Promise<void> {
    const my = ++token
    revoke()
    const parsed = url ? parsePeerTubeUrl(url) : null
    if (!parsed) return

    let captions
    try {
      captions = await getPeerTubeCaptions(parsed.host, parsed.videoId)
    } catch {
      return
    }
    if (my !== token || captions.length === 0) return

    const built: SubtitleTrack[] = []
    const abandon = (): void => built.forEach((t) => URL.revokeObjectURL(t.src))
    for (const c of captions) {
      try {
        const res = await fetch(c.url)
        if (my !== token) return abandon() // переключились — чистим уже собранное
        if (!res.ok) continue
        const text = await res.text()
        if (my !== token) return abandon()
        const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }))
        built.push({ language: c.language, label: c.label, src: blobUrl })
      } catch {
        /* пропускаем недоступную дорожку */
      }
    }
    if (my !== token) return abandon()
    tracks.value = built
  }

  watch(videoUrl, (u) => void load(u), { immediate: true })
  onBeforeUnmount(revoke)

  return { subtitleTracks: tracks }
}
