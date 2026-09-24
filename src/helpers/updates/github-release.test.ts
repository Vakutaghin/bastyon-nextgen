import { describe, it, expect } from 'vitest'
import {
  LATEST_RELEASE_URL,
  RELEASES_PAGE_URL,
  isUpdateAvailable,
  parseLatestRelease,
} from './github-release'

const RELEASE = {
  tag_name: 'v0.3.0',
  name: 'v0.3.0',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/v0.3.0',
  published_at: '2026-09-24T15:00:00Z',
}

describe('parseLatestRelease', () => {
  it('разбирает нормальный релиз', () => {
    expect(parseLatestRelease(RELEASE)).toEqual({
      version: '0.3.0',
      tag: 'v0.3.0',
      pageUrl: 'https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/v0.3.0',
      publishedAt: '2026-09-24T15:00:00Z',
    })
  })

  it('отбрасывает черновик и предрелиз', () => {
    expect(parseLatestRelease({ ...RELEASE, draft: true })).toBeNull()
    expect(parseLatestRelease({ ...RELEASE, prerelease: true })).toBeNull()
  })

  it('отбрасывает тег без номера версии', () => {
    expect(parseLatestRelease({ ...RELEASE, tag_name: 'nightly' })).toBeNull()
    expect(parseLatestRelease({ ...RELEASE, tag_name: '' })).toBeNull()
    expect(parseLatestRelease({ ...RELEASE, tag_name: undefined })).toBeNull()
  })

  it('переживает мусор вместо объекта', () => {
    expect(parseLatestRelease(null)).toBeNull()
    expect(parseLatestRelease('boom')).toBeNull()
    expect(parseLatestRelease([RELEASE])).toBeNull()
  })

  it('без html_url собирает ссылку на тег сам', () => {
    const parsed = parseLatestRelease({ ...RELEASE, html_url: undefined })
    expect(parsed?.pageUrl).toBe(`${RELEASES_PAGE_URL}/tag/v0.3.0`)
  })

  it('без даты публикации не падает', () => {
    expect(parseLatestRelease({ ...RELEASE, published_at: null })?.publishedAt).toBeNull()
  })
})

describe('isUpdateAvailable', () => {
  const release = parseLatestRelease(RELEASE)!

  it('видит более новую версию', () => {
    expect(isUpdateAvailable(release, '0.2.0')).toBe(true)
  })

  it('на той же и более новой версии молчит', () => {
    expect(isUpdateAvailable(release, '0.3.0')).toBe(false)
    expect(isUpdateAvailable(release, '0.4.0')).toBe(false)
  })

  it('не предлагает обновление сборке без внятной версии', () => {
    expect(isUpdateAvailable(release, 'dev')).toBe(false)
  })
})

describe('LATEST_RELEASE_URL', () => {
  it('указывает на api.github.com и репозиторий приложения', () => {
    expect(LATEST_RELEASE_URL).toBe(
      'https://api.github.com/repos/Vakutaghin/bastyon-nextgen/releases/latest'
    )
  })
})
