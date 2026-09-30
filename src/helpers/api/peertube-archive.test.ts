// Где лежат ролики выведенных из работы PeerTube-нод.

import { describe, expect, it } from 'vitest'
import {
  ARCHIVED_PEERTUBE_HOSTS,
  PEERTUBE_MAIN_ARCHIVE,
  peertubeArchiveFor,
} from './peertube-archive'

describe('peertubeArchiveFor', () => {
  it('выведенная нода — общий архив, без учёта регистра и пробелов', () => {
    expect(peertubeArchiveFor('peertube3501.pocketnet.app')).toBe(PEERTUBE_MAIN_ARCHIVE)
    expect(peertubeArchiveFor(' PocketnetPeertube5.nohost.me ')).toBe(PEERTUBE_MAIN_ARCHIVE)
  })

  it('600-я и 700-я ушли на соседние ноды', () => {
    expect(peertubeArchiveFor('peertube600.pocketnet.app')).toBe('peertube601.pocketnet.app')
    expect(peertubeArchiveFor('peertube700.pocketnet.app')).toBe('peertube701.pocketnet.app')
  })

  it('рабочая нода и сам архив — не выведенные', () => {
    expect(peertubeArchiveFor('peertube1000.pocketnet.app')).toBeNull()
    expect(peertubeArchiveFor('peertube601.pocketnet.app')).toBeNull()
    expect(peertubeArchiveFor(PEERTUBE_MAIN_ARCHIVE)).toBeNull()
  })

  it('в списке 71 нода, без повторов и в нижнем регистре', () => {
    expect(ARCHIVED_PEERTUBE_HOSTS).toHaveLength(71)
    expect(new Set(ARCHIVED_PEERTUBE_HOSTS).size).toBe(71)
    expect(ARCHIVED_PEERTUBE_HOSTS.every((h) => h === h.toLowerCase())).toBe(true)
  })
})
