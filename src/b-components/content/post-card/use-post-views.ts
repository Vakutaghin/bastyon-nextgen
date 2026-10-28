// Просмотры ролика под постом — как в ленте старого клиента (глаз и число).
// Берутся из того же описания видеосервера, что плеер берёт для превью
// (кэш peertube-api), поэтому лишних запросов нет. У прямого эфира — сколько
// смотрят сейчас. Ноль и неизвестное число не показываем.

import { ref, watch } from 'vue'
import { getPeerTubeVideoInfo, parsePeerTubeUrl } from '@/helpers/api/peertube-url'

export function usePostViews(
  videoUrl: () => string | undefined,
  findInfo: typeof getPeerTubeVideoInfo = getPeerTubeVideoInfo
) {
  const count = ref<number | null>(null)
  const live = ref(false)
  let generation = 0

  watch(
    videoUrl,
    async (url) => {
      const mine = ++generation
      count.value = null
      live.value = false
      const parsed = url ? parsePeerTubeUrl(url) : null
      if (!parsed) return
      try {
        const info = await findInfo(parsed.host, parsed.videoId)
        if (mine !== generation) return
        live.value = info.isLive === true
        const n = live.value ? info.viewers : info.views
        count.value = typeof n === 'number' && n > 0 ? n : null
      } catch {
        // Ролика не нашли — плеер скажет об этом сам, счётчика просто нет.
      }
    },
    { immediate: true }
  )

  return { count, live }
}
