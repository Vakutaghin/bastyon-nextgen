// Встраиваемые ролики поста: YouTube и Vimeo из ссылки поста и текста, и где
// плеер YouTube вообще может работать.

import { describe, expect, it } from 'vitest'
import { canEmbedYoutube, getVideoEmbeds } from './video-embed-url'

const YT = 'dQw4w9WgXcQ'

describe('getVideoEmbeds', () => {
  it('ссылка поста прежнего клиента (только `u`) даёт плеер', () => {
    expect(getVideoEmbeds(`https://youtu.be/${YT}`, 'Смотрите!')).toEqual([
      {
        kind: 'youtube',
        id: YT,
        embedUrl: `https://www.youtube.com/embed/${YT}`,
        watchUrl: `https://www.youtube.com/watch?v=${YT}`,
      },
    ])
  })

  it('один ролик в `u` и в тексте — один плеер', () => {
    const embeds = getVideoEmbeds(
      `https://www.youtube.com/watch?v=${YT}`,
      `Видео: https://youtu.be/${YT}.`
    )
    expect(embeds).toHaveLength(1)
  })

  it('Vimeo встраивается так же', () => {
    expect(getVideoEmbeds(undefined, 'Клип https://vimeo.com/76979871')).toEqual([
      {
        kind: 'vimeo',
        id: '76979871',
        embedUrl: 'https://player.vimeo.com/video/76979871',
        watchUrl: 'https://vimeo.com/76979871',
      },
    ])
  })

  it('обычные ссылки и PeerTube — не эмбеды', () => {
    expect(getVideoEmbeds('https://site.org/a', 'peertube://host/uuid', undefined)).toEqual([])
  })
})

describe('canEmbedYoutube', () => {
  it('на http(s)-странице — да, на tauri:// («Ошибка 153») — нет', () => {
    expect(canEmbedYoutube('https:')).toBe(true)
    expect(canEmbedYoutube('http:')).toBe(true)
    expect(canEmbedYoutube('tauri:')).toBe(false)
    expect(canEmbedYoutube(undefined)).toBe(false)
  })
})
