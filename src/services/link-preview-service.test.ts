import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cachedLinkPreview,
  clearLinkPreviewCache,
  fetchLinkPreview,
  normalizeLinkPreview,
} from './link-preview-service'

beforeEach(() => clearLinkPreviewCache())

describe('normalizeLinkPreview', () => {
  it('берёт заголовок, описание, сайт и картинку из og', () => {
    const preview = normalizeLinkPreview('https://x.com/a/status/1', {
      og: {
        title: 'Soviet Visuals (@sovietvisuals) on X',
        description: '&quot;Peace to the World!&quot; Soviet badge, 1957.',
        site_name: 'X (formerly Twitter)',
        image: 'https://pbs.twimg.com/media/a.jpg',
      },
    })
    expect(preview).toEqual({
      url: 'https://x.com/a/status/1',
      title: 'Soviet Visuals (@sovietvisuals) on X',
      description: '"Peace to the World!" Soviet badge, 1957.',
      siteName: 'X (formerly Twitter)',
      image: 'https://pbs.twimg.com/media/a.jpg',
    })
  })

  it('относительная картинка — от адреса страницы; не http(s) — отбрасывается', () => {
    expect(
      normalizeLinkPreview('https://site.org/news/1', { og: { title: 't', image: '/img/a.png' } })
        ?.image
    ).toBe('https://site.org/img/a.png')
    expect(
      normalizeLinkPreview('https://site.org/', {
        og: { title: 't', image: 'javascript:alert(1)' },
      })?.image
    ).toBeUndefined()
  })

  it('длинное описание обрезается, разметка в тексте не выполняется', () => {
    const long = 'слово '.repeat(100)
    const preview = normalizeLinkPreview('https://s.org/', {
      og: { title: '<b>Жирный</b> <img src=x onerror=alert(1)>', description: long },
    })
    expect(preview?.title).toBe('Жирный')
    expect(preview?.description?.length).toBeLessThanOrEqual(221)
    expect(preview?.description?.endsWith('…')).toBe(true)
  })

  it('заглушка Cloudflare вместо страницы — превью нет', () => {
    expect(
      normalizeLinkPreview('https://c.org/a', { og: { title: 'Just a moment...' } })
    ).toBeNull()
  })

  it('пустой og или ответ без og — превью нет', () => {
    expect(normalizeLinkPreview('https://a.b/', { og: {} })).toBeNull()
    expect(normalizeLinkPreview('https://a.b/', { og: { type: 'website' } })).toBeNull()
    expect(normalizeLinkPreview('https://a.b/', null)).toBeNull()
  })
})

describe('fetchLinkPreview', () => {
  it('спрашивает ноду urlPreview без подписи и запоминает ответ', async () => {
    const fetchHttp = vi.fn().mockResolvedValue({ og: { title: 'T' } })
    const first = await fetchLinkPreview('https://a.b/1', { fetchHttp })
    const second = await fetchLinkPreview('https://a.b/1', { fetchHttp })
    expect(first).toEqual({ url: 'https://a.b/1', title: 'T' })
    expect(second).toEqual(first)
    expect(fetchHttp).toHaveBeenCalledTimes(1)
    expect(fetchHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'urlPreview',
        data: { url: 'https://a.b/1' },
        options: expect.objectContaining({ auth: false }),
      })
    )
  })

  it('одновременные запросы одной ссылки — один поход к ноде', async () => {
    const fetchHttp = vi.fn().mockResolvedValue({ og: { title: 'T' } })
    await Promise.all([
      fetchLinkPreview('https://a.b/2', { fetchHttp }),
      fetchLinkPreview('https://a.b/2', { fetchHttp }),
    ])
    expect(fetchHttp).toHaveBeenCalledTimes(1)
  })

  it('«превью нет» запоминается, сбой сети — нет', async () => {
    const empty = vi.fn().mockResolvedValue({ og: {} })
    expect(await fetchLinkPreview('https://a.b/3', { fetchHttp: empty })).toBeNull()
    expect(cachedLinkPreview('https://a.b/3')).toBeNull()

    const offline = vi.fn().mockRejectedValue(new Error('All HTTP servers failed'))
    expect(await fetchLinkPreview('https://a.b/4', { fetchHttp: offline })).toBeNull()
    expect(cachedLinkPreview('https://a.b/4')).toBeUndefined()
  })
})
