// «Новые ролики подписок — сами»: что брать (ролики после прошлой проверки,
// свежие первыми, без скачанного, треков и трансляций) и что пора убрать
// (скачанное само этим аккаунтом, которому неделя, без «Оставить»).

import { describe, expect, it } from 'vitest'
import { AUTO_KEEP_MS, autoCandidates, autoItems, expiredAuto, postTimeMs } from './offline-auto'
import type { OfflineItem } from './types'

const at = (ms: number) => new Date(ms).toISOString()
const post = (url: string, ms: number, type = 'video') => ({
  type,
  videoUrl: url,
  timestamp: at(ms),
})

function item(id: string, meta: Partial<OfflineItem['meta']>): OfflineItem {
  return {
    id,
    meta: {
      id,
      peertubeUrl: `peertube://h/${id}`,
      kind: 'video',
      uuid: id,
      title: id,
      author: { address: 'PA' },
      height: 360,
      size: 1,
      createdAt: 1,
      accounts: ['PMe'],
      ...meta,
    },
    state: { status: 'done', received: 1, total: 1 },
  }
}

describe('offline-auto', () => {
  it('кандидаты: после since, свежие первыми, без скачанного, треков, трансляций и повторов', () => {
    const posts = [
      post('peertube://h/old', 1_000),
      post('peertube://h/a', 3_000),
      post('peertube://h/song/audio', 4_000, 'audio'),
      post('peertube://h/live/stream', 5_000),
      post('peertube://h/have', 6_000),
      post('peertube://h/b', 7_000),
      post('peertube://h/b', 7_000),
      { type: 'video', videoUrl: 'https://youtu.be/x', timestamp: at(8_000) },
    ]
    const picked = autoCandidates(posts, {
      since: 2_000,
      have: (url) => url.endsWith('/have'),
      limit: 5,
    })
    expect(picked.map((p) => p.videoUrl)).toEqual(['peertube://h/b', 'peertube://h/a'])
    expect(autoCandidates(posts, { since: 0, have: () => false, limit: 1 })).toHaveLength(1)
    expect(autoCandidates(posts, { since: 0, have: () => false, limit: 0 })).toEqual([])
    expect(postTimeMs({ timestamp: 'не дата' })).toBe(0)
  })

  it('убрать: своё скачанное само старше недели; оставленное, чужое и ручное — нет', () => {
    const now = 10 * AUTO_KEEP_MS
    const list = [
      item('old', { auto: now - AUTO_KEEP_MS }),
      item('fresh', { auto: now - AUTO_KEEP_MS + 1 }),
      item('kept', {}),
      item('other', { auto: 1, accounts: ['POther'] }),
    ]
    expect(expiredAuto(list, 'PMe', now).map((i) => i.id)).toEqual(['old'])
    expect(autoItems(list, 'PMe').map((i) => i.id)).toEqual(['old', 'fresh'])
  })
})
