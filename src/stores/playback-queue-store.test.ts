// Очередь проигрывания: порядок, повтор, перемешивание, «играть следующим».

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { shuffledOrder, usePlaybackQueueStore, type QueueItem } from './playback-queue-store'

const item = (id: string, type: QueueItem['type'] = 'audio'): QueueItem => ({
  id,
  type,
  url: `peertube://h/${id}/audio`,
  title: id,
  artist: 'a',
  address: 'P',
  cover: null,
  duration: null,
})

const ids = (list: QueueItem[]): string[] => list.map((x) => x.id)

beforeEach(() => setActivePinia(createPinia()))

describe('playback-queue-store', () => {
  it('начинает с выбранного и идёт по порядку до конца', () => {
    const q = usePlaybackQueueStore()
    q.play([item('a'), item('b'), item('c')], 1)
    expect(q.current?.id).toBe('b')
    expect(q.next()).toBe(true)
    expect(q.current?.id).toBe('c')
    expect(q.hasNext).toBe(false)
    expect(q.next()).toBe(false)
    expect(q.previous()).toBe(true)
    expect(q.current?.id).toBe('b')
  })

  it('элементы без ссылки в очередь не попадают', () => {
    const q = usePlaybackQueueStore()
    q.play([{ ...item('a'), url: '' }, item('b')], 0)
    expect(ids(q.items)).toEqual(['b'])
    expect(q.current?.id).toBe('b')
  })

  it('повтор всего списка — по кругу, одного трека — тот же, но «следующий» вручную идёт дальше', () => {
    const q = usePlaybackQueueStore()
    q.play([item('a'), item('b')], 1)
    q.cycleRepeat()
    expect(q.repeat).toBe('all')
    expect(q.next()).toBe(true)
    expect(q.current?.id).toBe('a')
    q.cycleRepeat()
    expect(q.repeat).toBe('one')
    const gen = q.generation
    expect(q.next(true)).toBe(true)
    expect(q.current?.id).toBe('a')
    expect(q.generation).toBe(gen + 1)
    q.next()
    expect(q.current?.id).toBe('b')
  })

  it('перемешивание держит текущий первым и обратимо', () => {
    const order = shuffledOrder(5, 3, () => 0)
    expect(order[0]).toBe(3)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4])

    const q = usePlaybackQueueStore()
    q.play([item('a'), item('b'), item('c'), item('d')], 2)
    q.toggleShuffle()
    expect(q.current?.id).toBe('c')
    expect(q.order[0]).toBe(2)
    q.toggleShuffle()
    expect(q.order).toEqual([0, 1, 2, 3])
    expect(q.current?.id).toBe('c')
  })

  it('«играть следующим» и «в конец», без перезапуска текущего; уже стоящий переезжает', () => {
    const q = usePlaybackQueueStore()
    q.play([item('a'), item('b'), item('c')], 0)
    const gen = q.generation
    q.enqueue(item('x'), 'next')
    expect(ids(q.upcoming)).toEqual(['x', 'b', 'c'])
    q.enqueue(item('b'), 'end')
    expect(ids(q.upcoming)).toEqual(['x', 'c', 'b'])
    expect(q.current?.id).toBe('a')
    expect(q.generation).toBe(gen)
  })

  it('пустая очередь начинается с поставленного', () => {
    const q = usePlaybackQueueStore()
    q.enqueue(item('x'), 'end')
    expect(q.current?.id).toBe('x')
    q.clear()
    expect(q.active).toBe(false)
  })
})
