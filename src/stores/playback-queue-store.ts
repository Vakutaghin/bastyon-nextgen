// Очередь проигрывания: плейлист, коллекция, «Моя музыка», лента раздела.
//
// Один список на приложение. Аудио играет мини-плеер внизу экрана
// (b-components/media/mini-player), видео — страница поста: очередь говорит,
// что текущее, а кто и где его покажет, решают они. «Перемешать» переставляет
// порядок, не трогая сам список; «Повтор» — нет, весь список, один трек.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type QueueMediaType = 'video' | 'audio'

export interface QueueItem {
  /** txid поста. */
  id: string
  type: QueueMediaType
  /** Указатель `peertube://…`. */
  url: string
  title: string
  /** Имя автора. */
  artist: string
  address: string
  cover: string | null
  /** Секунды, если известно. */
  duration: number | null
}

/** Откуда очередь — для подписи «Сейчас играет» и ссылки назад. */
export interface QueueSource {
  title: string
  /** Куда вернуться: страница плейлиста, раздел. */
  path?: string
}

export type RepeatMode = 'off' | 'all' | 'one'

/** Перемешивание Фишера — Йетса; текущий остаётся первым. */
export function shuffledOrder(length: number, first: number, random = Math.random): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
  }
  return first >= 0 && first < length ? [first, ...rest] : rest
}

export const usePlaybackQueueStore = defineStore('playback-queue', () => {
  const items = ref<QueueItem[]>([])
  /** Порядок проигрывания — номера в `items`. */
  const order = ref<number[]>([])
  /** Место в `order`. */
  const position = ref(-1)
  const shuffle = ref(false)
  const repeat = ref<RepeatMode>('off')
  const source = ref<QueueSource | null>(null)
  /** Растёт при каждом выборе трека: тот же трек заново — тоже событие. */
  const generation = ref(0)

  const current = computed<QueueItem | null>(() => {
    const index = order.value[position.value]
    return index === undefined ? null : (items.value[index] ?? null)
  })
  /** Номер текущего в исходном списке. */
  const currentIndex = computed(() => order.value[position.value] ?? -1)
  const active = computed(() => !!current.value)
  const hasNext = computed(
    () =>
      position.value < order.value.length - 1 || (repeat.value === 'all' && items.value.length > 1)
  )
  const hasPrevious = computed(() => position.value > 0 || repeat.value === 'all')

  /** Следующие по порядку — для панели «Далее». */
  const upcoming = computed<QueueItem[]>(() =>
    order.value
      .slice(position.value + 1)
      .map((i) => items.value[i])
      .filter((x): x is QueueItem => !!x)
  )

  function select(at: number): void {
    position.value = at
    generation.value += 1
  }

  /** Начать список с элемента `start`. */
  function play(list: readonly QueueItem[], start = 0, from: QueueSource | null = null): void {
    const playable = list.filter((x) => !!x.url)
    if (!playable.length) return
    const first = Math.max(
      0,
      playable.findIndex((x) => x.id === list[start]?.id)
    )
    items.value = [...playable]
    source.value = from
    order.value = shuffle.value ? shuffledOrder(playable.length, first) : playable.map((_, i) => i)
    select(order.value.indexOf(first))
  }

  /** Перейти к месту в порядке проигрывания (нативный плеер ушёл вперёд). */
  function goTo(at: number): void {
    if (at >= 0 && at < order.value.length) select(at)
  }

  /** Перейти к элементу списка по его номеру в `items`. */
  function jump(index: number): void {
    const at = order.value.indexOf(index)
    if (at >= 0) select(at)
  }

  /** Следующий. `auto` — трек доиграл сам: «повтор одного» его и повторит. */
  function next(auto = false): boolean {
    if (!items.value.length) return false
    if (auto && repeat.value === 'one') {
      select(position.value)
      return true
    }
    if (position.value < order.value.length - 1) {
      select(position.value + 1)
      return true
    }
    if (repeat.value === 'all') {
      if (shuffle.value) order.value = shuffledOrder(items.value.length, -1)
      select(0)
      return true
    }
    return false
  }

  function previous(): boolean {
    if (position.value > 0) {
      select(position.value - 1)
      return true
    }
    if (repeat.value === 'all' && order.value.length) {
      select(order.value.length - 1)
      return true
    }
    return false
  }

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value
    const now = currentIndex.value
    order.value = shuffle.value
      ? shuffledOrder(items.value.length, now)
      : items.value.map((_, i) => i)
    position.value = Math.max(0, order.value.indexOf(now))
  }

  function cycleRepeat(): void {
    repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off'
  }

  /** Очередь закрыли: мини-плеер прячется. */
  function clear(): void {
    items.value = []
    order.value = []
    position.value = -1
    source.value = null
  }

  /**
   * Поставить в очередь: `next` — сразу после текущего, иначе в конец. Очереди
   * нет — она начинается с него. Уже стоящий — переезжает.
   */
  function enqueue(item: QueueItem, placement: 'next' | 'end'): void {
    if (!item.url) return
    if (!current.value) {
      play([item], 0, null)
      return
    }
    const playing = current.value
    if (item.id === playing.id) return
    const ordered = order.value
      .map((i) => items.value[i])
      .filter((x): x is QueueItem => !!x && x.id !== item.id)
    const at = ordered.findIndex((x) => x.id === playing.id)
    if (placement === 'next') ordered.splice(at + 1, 0, item)
    else ordered.push(item)
    // Порядок проигрывания становится самим списком: перемешанное остаётся перемешанным.
    items.value = ordered
    order.value = ordered.map((_, i) => i)
    position.value = at
  }

  /** Сведения пришли позже (длительность, обложка) — без перезапуска трека. */
  function patch(id: string, update: Partial<Pick<QueueItem, 'duration' | 'cover'>>): void {
    items.value = items.value.map((x) => (x.id === id ? { ...x, ...update } : x))
  }

  return {
    items,
    order,
    position,
    shuffle,
    repeat,
    source,
    generation,
    current,
    currentIndex,
    active,
    hasNext,
    hasPrevious,
    upcoming,
    play,
    goTo,
    jump,
    next,
    previous,
    toggleShuffle,
    cycleRepeat,
    clear,
    enqueue,
    patch,
  }
})
