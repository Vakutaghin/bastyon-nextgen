// Список «Медиастудии»: поиск по названию, описанию и постам, фильтр «в
// постах / без поста», порядок и запоминание вида.

import { afterEach, describe, expect, it } from 'vitest'

import {
  loadStudioView,
  saveStudioView,
  studioTotals,
  studioVideos,
  STUDIO_VIEW_KEY,
} from './studio-list'
import type { ServerVideo } from './use-server-videos'

const video = (over: Partial<ServerVideo>): ServerVideo => ({
  host: 'h',
  id: 1,
  uuid: 'u',
  name: '',
  description: '',
  pointer: `peertube://h/${over.uuid ?? 'u'}`,
  thumbnailUrl: null,
  duration: null,
  views: null,
  isAudio: false,
  processing: false,
  posted: false,
  posts: [],
  time: 0,
  ...over,
})

const LIST = [
  video({ uuid: 'a', name: 'Ёлка', description: 'Зимний лес', views: 10, time: 1, posted: true }),
  video({ uuid: 'b', name: 'море', views: null, time: 3 }),
  video({ uuid: 'c', name: 'Горы 10', views: 50, time: 2 }),
  video({ uuid: 'd', name: 'Горы 2', views: 50, time: 4 }),
]
const names = (list: ServerVideo[]) => list.map((v) => v.name)
const query = (over: Partial<Parameters<typeof studioVideos>[1]> = {}) => ({
  search: '',
  filter: 'all' as const,
  sort: 'newest' as const,
  isPublishing: (v: ServerVideo) => v.uuid === 'b',
  ...over,
})

describe('studioVideos', () => {
  it('поиск: все слова, без регистра, «ё» как «е», в описании и постах', () => {
    expect(names(studioVideos(LIST, query({ search: 'ЕЛКА' })))).toEqual(['Ёлка'])
    expect(names(studioVideos(LIST, query({ search: 'зимний лес' })))).toEqual(['Ёлка'])
    expect(names(studioVideos(LIST, query({ search: 'лес горы' })))).toEqual([])
    const withPost = [video({ name: 'x', posts: [{ txid: 't', caption: 'Отпуск', time: 0 }] })]
    expect(studioVideos(withPost, query({ search: 'отпуск' }))).toHaveLength(1)
  })

  it('фильтр: пост ждёт блока — уже «в постах», не «без поста»', () => {
    expect(names(studioVideos(LIST, query({ filter: 'posted' })))).toEqual(['море', 'Ёлка'])
    expect(names(studioVideos(LIST, query({ filter: 'unposted' })))).toEqual(['Горы 2', 'Горы 10'])
  })

  it('порядок: даты, просмотры (неизвестные — в конце), название с числами по-человечески', () => {
    expect(names(studioVideos(LIST, query({ sort: 'oldest' })))).toEqual([
      'Ёлка',
      'Горы 10',
      'море',
      'Горы 2',
    ])
    expect(names(studioVideos(LIST, query({ sort: 'views' })))).toEqual([
      'Горы 2',
      'Горы 10',
      'Ёлка',
      'море',
    ])
    expect(names(studioVideos(LIST, query({ sort: 'name' })))).toEqual([
      'Горы 2',
      'Горы 10',
      'Ёлка',
      'море',
    ])
  })

  it('исходный список не меняется', () => {
    const before = names(LIST)
    studioVideos(LIST, query({ sort: 'name' }))
    expect(names(LIST)).toEqual(before)
  })
})

describe('сводка и вид', () => {
  afterEach(() => localStorage.clear())

  it('просмотры складываются, неизвестные не считаются', () => {
    expect(studioTotals(LIST)).toEqual({ count: 4, views: 110 })
  })

  it('вид запоминается; чужое значение — плитка', () => {
    expect(loadStudioView()).toBe('grid')
    saveStudioView('list')
    expect(loadStudioView()).toBe('list')
    localStorage.setItem(STUDIO_VIEW_KEY, 'table')
    expect(loadStudioView()).toBe('grid')
  })
})
