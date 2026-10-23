// Каналы в мессенджере: id в общем ряду с чатами, список, который правят два
// устройства сразу, и подписи постов в строке списка.

import { describe, expect, it } from 'vitest'
import type { AdaptedPost } from '@/types/adapted-post'
import {
  channelAddresses,
  channelAddressOf,
  channelChatId,
  channelPostPreview,
  countNewPosts,
  isChannelChatId,
  mergeChannelsDoc,
  parseChannelsDoc,
  postBodyText,
  sameChannelsDoc,
  type ChannelsDoc,
} from './channels'

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

function post(over: Partial<AdaptedPost> = {}): AdaptedPost {
  return {
    id: 'tx1',
    txid: 'tx1',
    author: { name: 'alice', address: ALICE, avatar: null, reputation: 0, letter: 'A' },
    title: '',
    content: '',
    timestamp: new Date(1_700_000_000_000).toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    tags: [],
    type: 'share',
    category: 'share',
    images: [],
    ratingStars: 0,
    scoreCnt: 0,
    ...over,
  }
}

describe('id канала', () => {
  it('отличается от комнат Matrix и mesh-диалогов и даёт адрес обратно', () => {
    const id = channelChatId(ALICE)
    expect(isChannelChatId(id)).toBe(true)
    expect(channelAddressOf(id)).toBe(ALICE)
    expect(isChannelChatId('!room:matrix.pocketnet.app')).toBe(false)
    expect(channelAddressOf('mesh:lx:abcd:u:ef')).toBeNull()
    expect(channelAddressOf(null)).toBeNull()
  })
})

describe('список каналов', () => {
  it('с сервера берётся только то, что похоже на запись: чужое и битое — мимо', () => {
    const doc = parseChannelsDoc({
      v: 1,
      items: {
        [ALICE]: { on: true, t: 10, seen: 5 },
        [BOB]: { on: 'yes', t: 10 },
        'not-an-address': { on: true, t: 1 },
      },
    })
    expect(doc.items).toEqual({ [ALICE]: { on: true, t: 10, seen: 5 } })
    expect(parseChannelsDoc(undefined).items).toEqual({})
    expect(parseChannelsDoc('garbage').items).toEqual({})
  })

  it('два устройства: у каждого автора побеждает последнее «вкл/выкл», прочитанное — самое дальнее', () => {
    const phone: ChannelsDoc = {
      v: 1,
      items: { [ALICE]: { on: false, t: 20, seen: 100 }, [BOB]: { on: true, t: 5 } },
    }
    const desktop: ChannelsDoc = {
      v: 1,
      items: { [ALICE]: { on: true, t: 10, seen: 300 } },
    }
    const merged = mergeChannelsDoc(desktop, phone)
    expect(merged.items[ALICE]).toEqual({ on: false, t: 20, seen: 300 })
    expect(merged.items[BOB]).toEqual({ on: true, t: 5 })
    // Порядок слияния не важен.
    expect(sameChannelsDoc(merged, mergeChannelsDoc(phone, desktop))).toBe(true)
  })

  it('включённые — недавно добавленные первыми', () => {
    const doc: ChannelsDoc = {
      v: 1,
      items: { [ALICE]: { on: true, t: 1 }, [BOB]: { on: true, t: 2 } },
    }
    expect(channelAddresses(doc)).toEqual([BOB, ALICE])
    doc.items[BOB]!.on = false
    expect(channelAddresses(doc)).toEqual([ALICE])
  })
})

describe('пост в строке списка', () => {
  it('заголовок важнее текста, длинное обрезается', () => {
    expect(channelPostPreview(post({ title: 'Новости', content: 'текст' })).text).toBe('Новости')
    const long = channelPostPreview(post({ content: 'а'.repeat(500) })).text
    expect(long.length).toBeLessThanOrEqual(141)
    expect(long.endsWith('…')).toBe(true)
  })

  it('вид поста: репост, видео, статья, фото, текст', () => {
    expect(channelPostPreview(post({ repost: 'orig' })).kind).toBe('repost')
    expect(channelPostPreview(post({ type: 'video' })).kind).toBe('video')
    expect(channelPostPreview(post({ type: 'article' })).kind).toBe('article')
    expect(channelPostPreview(post({ images: ['a.jpg'] })).kind).toBe('image')
    expect(channelPostPreview(post()).kind).toBe('text')
  })

  it('статья — текстом из блоков, без разметки', () => {
    const content = JSON.stringify({
      blocks: [
        { type: 'header', data: { text: 'Глава <b>1</b>' } },
        { type: 'paragraph', data: { text: 'Начало истории' } },
      ],
    })
    const preview = channelPostPreview(post({ type: 'article', content }))
    expect(preview.text).toBe('Глава 1 Начало истории')
  })

  it('время — из даты поста, в миллисекундах', () => {
    expect(channelPostPreview(post()).time).toBe(1_700_000_000_000)
  })
})

describe('текст поста в ленте канала', () => {
  it('абзацы остаются, разметка уходит', () => {
    expect(postBodyText(post({ content: 'Первая<br>вторая<p>третья</p>  <i>и</i>  всё' }))).toBe(
      'Первая\nвторая\nтретья\nи всё'
    )
  })
})

describe('новые посты', () => {
  it('считаются от прочитанного; без отметки — нового нет', () => {
    expect(countNewPosts([30, 20, 10], 15)).toBe(2)
    expect(countNewPosts([30, 20, 10], 30)).toBe(0)
    expect(countNewPosts([30, 20, 10], undefined)).toBe(0)
  })
})
