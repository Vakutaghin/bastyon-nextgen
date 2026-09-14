import { describe, it, expect } from 'vitest'

import { mapMediaContent, mediaTypeOf } from './media-content'

const resolve = (u: string) => (u.startsWith('mxc://') ? `https://hs/media/${u.slice(6)}` : u)
const secrets = { keys: 'wrapped', block: 10 }

describe('mediaTypeOf', () => {
  it('знает четыре медиа-msgtype, остальное — null', () => {
    expect(mediaTypeOf('m.image')).toBe('image')
    expect(mediaTypeOf('m.video')).toBe('video')
    expect(mediaTypeOf('m.file')).toBe('file')
    expect(mediaTypeOf('m.audio')).toBe('audio')
    expect(mediaTypeOf('m.text')).toBeNull()
    expect(mediaTypeOf(undefined)).toBeNull()
  })
})

describe('mapMediaContent (K3)', () => {
  it('m.image: url из mxc → http, размеры/секреты из info, имя из body', () => {
    const content = {
      msgtype: 'm.image',
      body: 'cat.jpg',
      url: 'mxc://hs/abc',
      info: { mimetype: 'image/jpeg', w: 10, h: 20, size: 5, secrets },
    }
    const m = mapMediaContent(content, 'image', resolve)
    expect(m).toMatchObject({ type: 'image', url: 'https://hs/media/hs/abc', text: 'cat.jpg' })
    expect(m.info).toMatchObject({ w: 10, h: 20, secrets, name: 'cat.jpg' })
    // info события не мутируется
    expect(content.info).not.toHaveProperty('name')
  })

  it('m.video: постер mxc резолвится в posterUrl', () => {
    const m = mapMediaContent(
      {
        msgtype: 'm.video',
        body: 'clip.mp4',
        url: 'https://hs/v',
        info: { thumbnail_url: 'mxc://hs/p', duration: 3 },
      },
      'video',
      resolve
    )
    expect(m.url).toBe('https://hs/v')
    expect(m.info.posterUrl).toBe('https://hs/media/hs/p')
    expect(m.info.duration).toBe(3)
  })

  it('S34: httpUrl/thumbnail_url из контента проходят резолвер — чужой хост убирается', () => {
    // Резолвер «доверяет» только hs: чужой абсолютный URL → ''.
    const strict = (u: string) =>
      u.startsWith('mxc://')
        ? `https://hs/media/${u.slice(6)}`
        : u.startsWith('https://hs/')
          ? u
          : ''
    const m = mapMediaContent(
      {
        msgtype: 'm.video',
        body: 'clip.mp4',
        url: 'https://evil.example/track.mp4',
        info: {
          httpUrl: 'https://evil.example/track2.mp4',
          thumbnail_url: 'https://evil.example/t.png',
        },
      },
      'video',
      strict
    )
    expect(m.url).toBeFalsy()
    expect(m.info).not.toHaveProperty('httpUrl')
    expect(m.info).not.toHaveProperty('thumbnail_url')
    expect(m.info).not.toHaveProperty('posterUrl')

    const ok = mapMediaContent(
      {
        msgtype: 'm.video',
        body: 'clip.mp4',
        url: 'mxc://hs/v',
        info: { httpUrl: 'https://hs/media/hs/v', thumbnail_url: 'https://hs/media/hs/t' },
      },
      'video',
      strict
    )
    expect(ok.url).toBe('https://hs/media/hs/v')
    expect(ok.info.httpUrl).toBe('https://hs/media/hs/v')
    expect(ok.info.posterUrl).toBe('https://hs/media/hs/t')
  })

  it('m.file legacy: body — JSON с name/type/size/url/secrets', () => {
    const body = JSON.stringify({
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 1234,
      url: 'https://hs/f',
      secrets,
    })
    const m = mapMediaContent({ msgtype: 'm.file', body, info: {} }, 'file', resolve)
    expect(m.url).toBe('https://hs/f')
    expect(m.info).toMatchObject({
      name: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 1234,
      secrets,
    })
    expect(m.text).toBe('doc.pdf')
  })

  it('m.file по Matrix-стандарту: имя из filename/body, url из content', () => {
    const m = mapMediaContent(
      {
        msgtype: 'm.file',
        body: 'notes.txt',
        filename: 'notes.txt',
        url: 'mxc://hs/n',
        info: { size: 7 },
      },
      'file',
      resolve
    )
    expect(m.url).toBe('https://hs/media/hs/n')
    expect(m.info.name).toBe('notes.txt')
  })

  it('m.audio: url из вложенных полей, text пустой (превью по type)', () => {
    const m = mapMediaContent(
      { msgtype: 'm.audio', body: 'voice', info: { file: { url: 'mxc://hs/a' }, duration: 2 } },
      'audio',
      resolve
    )
    expect(m.url).toBe('https://hs/media/hs/a')
    expect(m.text).toBe('')
    expect(m.info.duration).toBe(2)
  })
})
