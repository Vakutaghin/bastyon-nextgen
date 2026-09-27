// Превью ссылки для карточки: из кэша сразу, иначе запрос к ноде. В ленте
// (`lazy`) запрос уходит, только когда карточка подъехала к экрану: лента
// рисует десятки постов, и спрашивать ноду про все ссылки разом незачем.

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

import {
  cachedLinkPreview,
  fetchLinkPreview,
  type LinkPreview,
} from '@/services/link-preview-service'

/** За сколько до экрана начинать загрузку превью. */
const PRELOAD_MARGIN = '600px 0px'
/** Композер: ссылку ещё дописывают — спрашиваем ноду, когда адрес постоит спокойно. */
const TYPING_PAUSE_MS = 600

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useLinkPreviewCard(url: Ref<string>, root: Ref<HTMLElement | null>, lazy: boolean) {
  const preview = ref<LinkPreview | null>(null)
  const loading = ref(false)
  const nearScreen = ref(!lazy || typeof IntersectionObserver === 'undefined')

  let observer: IntersectionObserver | null = null
  const stopObserving = (): void => {
    observer?.disconnect()
    observer = null
  }

  if (!nearScreen.value) {
    watch(
      root,
      (el) => {
        stopObserving()
        if (!el || nearScreen.value) return
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              nearScreen.value = true
              stopObserving()
            }
          },
          { rootMargin: PRELOAD_MARGIN }
        )
        observer.observe(el)
      },
      { immediate: true }
    )
  }

  watch(
    [url, nearScreen],
    async ([link, visible]) => {
      const cached = link ? cachedLinkPreview(link) : null
      preview.value = cached ?? null
      if (!link || cached !== undefined || !visible) return
      if (!lazy) {
        await sleep(TYPING_PAUSE_MS)
        if (url.value !== link) return
      }
      loading.value = true
      const result = await fetchLinkPreview(link)
      if (url.value === link) {
        preview.value = result
        loading.value = false
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(stopObserving)

  return { preview, loading }
}
