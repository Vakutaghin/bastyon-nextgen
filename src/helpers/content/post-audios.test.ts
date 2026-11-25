// Записи аудио-поста: список в настройках писал кто угодно, поэтому берётся
// только то, что похоже на записи; ссылка поста всегда среди них.

import { describe, expect, it } from 'vitest'

import { exportPost, serializePost } from '@/blockchain/core/actions/post-action'
import {
  audiosSetting,
  MAX_POST_AUDIOS,
  parsePostAudios,
  postAudios,
  totalDuration,
} from './post-audios'

const url = (n: number | string) => `peertube://pt.example/uuid-${n}/audio`

describe('parsePostAudios', () => {
  it('список: порядок, названия, длительность', () => {
    expect(
      parsePostAudios(
        [
          { u: url(1), c: ' Глава 1 ', d: 600.4 },
          { u: url(2), c: 'Глава 2' },
          { u: url(3), d: 0 },
        ],
        url(1)
      )
    ).toEqual([
      { url: url(1), title: 'Глава 1', duration: 600 },
      { url: url(2), title: 'Глава 2', duration: null },
      { url: url(3), title: '', duration: null },
    ])
  })

  it('одна запись, не список, видео, пустая ссылка — обычный пост', () => {
    expect(parsePostAudios([{ u: url(1) }], url(1))).toEqual([])
    for (const raw of [undefined, null, 'x', {}, 5])
      expect(parsePostAudios(raw, url(1))).toEqual([])
    const list = [{ u: url(1) }, { u: url(2) }]
    expect(parsePostAudios(list, 'peertube://pt.example/uuid-1')).toEqual([])
    expect(parsePostAudios(list, undefined)).toEqual([])
  })

  it('чужое в списке — мимо, повторы — один раз', () => {
    const list = parsePostAudios(
      [
        null,
        'строка',
        { u: 5 },
        { u: 'https://evil.example/a.mp3' },
        { u: 'peertube://pt.example/uuid-9' },
        { u: url(1), c: 7, d: 'долго' },
        { u: url(1), c: 'повтор' },
        { u: url(2), d: Infinity },
        { u: url(3), d: 10 ** 9 },
      ],
      url(1)
    )
    expect(list).toEqual([
      { url: url(1), title: '', duration: null },
      { url: url(2), title: '', duration: null },
      { url: url(3), title: '', duration: null },
    ])
  })

  it('ссылки поста в списке нет — она первая', () => {
    expect(parsePostAudios([{ u: url(2) }], url(1)).map((a) => a.url)).toEqual([url(1), url(2)])
  })

  it('длинный список и длинное название обрезаются', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ u: url(i), c: 'я'.repeat(500) }))
    const list = parsePostAudios(many, url(0))
    expect(list).toHaveLength(MAX_POST_AUDIOS)
    expect(list[0]!.title).toHaveLength(120)
  })
})

describe('postAudios', () => {
  it('из адаптера; иначе из настроек; только у звука', () => {
    const audios = [
      { url: url(1), title: 'а', duration: 1 },
      { url: url(2), title: 'б', duration: 2 },
    ]
    expect(postAudios({ audios, type: 'audio', videoUrl: url(1) })).toBe(audios)
    const settings = { audios: [{ u: url(1) }, { u: url(2) }] }
    expect(postAudios({ type: 'audio', videoUrl: url(1), settings })).toHaveLength(2)
    expect(postAudios({ type: 'share', audios, videoUrl: url(1) })).toEqual([])
    expect(postAudios({ type: 'audio', videoUrl: url(1) })).toEqual([])
  })
})

describe('audiosSetting', () => {
  const list = [
    { url: url(1), title: ' Глава 1 ', duration: 61.7 },
    { url: url(2), title: '', duration: null },
  ]

  it('в настройки — от двух записей, пустое не пишется', () => {
    expect(audiosSetting(list)).toEqual([{ u: url(1), c: 'Глава 1', d: 62 }, { u: url(2) }])
    expect(audiosSetting(list.slice(0, 1))).toBeUndefined()
    expect(audiosSetting([])).toBeUndefined()
  })

  it('записанное читается обратно', () => {
    expect(parsePostAudios(audiosSetting(list), url(1))).toEqual([
      { url: url(1), title: 'Глава 1', duration: 62 },
      { url: url(2), title: '', duration: null },
    ])
  })

  it('в пост уходит в настройках, а хеш поста не меняется: нода его сверяет', () => {
    const post = { caption: 'Книга', url: url(1), tags: ['книга'], language: 'ru' }
    const book = { ...post, settings: { f: '0', audios: audiosSetting(list) } }
    expect((exportPost(book).s as { audios: unknown }).audios).toEqual(audiosSetting(list))
    expect((exportPost(post).s as { audios?: unknown }).audios).toBeUndefined()
    expect(serializePost(book)).toBe(serializePost(post))
  })
})

describe('totalDuration', () => {
  it('сумма; неизвестна хоть одна — неизвестна и она', () => {
    const at = (duration: number | null) => ({ url: url(1), title: '', duration })
    expect(totalDuration([at(60), at(30)])).toBe(90)
    expect(totalDuration([at(60), at(null)])).toBeNull()
    expect(totalDuration([])).toBeNull()
  })
})
