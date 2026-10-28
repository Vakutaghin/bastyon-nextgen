// Запуск и листание очереди проигрывания (stores/playback-queue-store):
// трек играет мини-плеер внизу экрана сам, ролик открывается страницей поста.

import { useRouter } from 'vue-router'
import {
  usePlaybackQueueStore,
  type QueueItem,
  type QueueSource,
} from '@/stores/playback-queue-store'

/** Ролик из очереди: страница поста запускает его сама и показывает «Далее». */
export const QUEUE_QUERY = 'queue'

export function usePlayback() {
  const queue = usePlaybackQueueStore()
  const router = useRouter()

  function openCurrent(): void {
    const item = queue.current
    if (item?.type !== 'video') return
    const route = router.currentRoute.value
    if (route.name === 'post' && route.params.txid === item.id) return
    void router.push({ name: 'post', params: { txid: item.id }, query: { [QUEUE_QUERY]: '1' } })
  }

  function playAll(
    items: readonly QueueItem[],
    start = 0,
    source: QueueSource | null = null
  ): void {
    queue.play(items, start, source)
    openCurrent()
  }

  function next(auto = false): boolean {
    const moved = queue.next(auto)
    if (moved) openCurrent()
    return moved
  }

  function previous(): boolean {
    const moved = queue.previous()
    if (moved) openCurrent()
    return moved
  }

  function jump(index: number): void {
    queue.jump(index)
    openCurrent()
  }

  return { queue, playAll, next, previous, jump, openCurrent }
}
