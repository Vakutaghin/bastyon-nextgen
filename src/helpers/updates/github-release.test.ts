import { describe, it, expect } from 'vitest'
import {
  LATEST_RELEASE_URL,
  RELEASES_PAGE_URL,
  isUpdateAvailable,
  parseLatestRelease,
  parseReleaseApk,
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
      androidApk: null,
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

// Файлы релиза — как их отдаёт api.github.com у v0.11.2 (22.10.2026).
const DOWNLOAD = 'https://github.com/Vakutaghin/bastyon-nextgen/releases/download/v0.11.2/'
const APK_ASSET = {
  name: 'Android-Bastyon-NextGen-0.11.2.apk',
  content_type: 'application/vnd.android.package-archive',
  size: 16456301,
  digest: 'sha256:50e4dfe12608de9633675216d5fb5384f7960429473f9a6ace09f25d214318eb',
  browser_download_url: `${DOWNLOAD}Android-Bastyon-NextGen-0.11.2.apk`,
}
const OTHER_ASSETS = [
  {
    name: 'latest.json',
    size: 2687,
    digest: 'sha256:70306ea4b667fafa190ced0df55eceac5e45e30f4bb6fd4b255e1203bec8f181',
    browser_download_url: `${DOWNLOAD}latest.json`,
  },
  {
    name: 'Windows-Bastyon-NextGen-0.11.2-x64.msi',
    size: 17338368,
    digest: 'sha256:841a0ab0c053d845d70539eb673dc749aae1966b90d6e330015b8f568f057c95',
    browser_download_url: `${DOWNLOAD}Windows-Bastyon-NextGen-0.11.2-x64.msi`,
  },
]

describe('parseReleaseApk', () => {
  it('находит APK релиза с размером и SHA-256', () => {
    expect(parseReleaseApk([...OTHER_ASSETS, APK_ASSET], 'v0.11.2')).toEqual({
      url: APK_ASSET.browser_download_url,
      size: 16456301,
      sha256: '50e4dfe12608de9633675216d5fb5384f7960429473f9a6ace09f25d214318eb',
    })
    expect(
      parseLatestRelease({ ...RELEASE, tag_name: 'v0.11.2', assets: [APK_ASSET] })?.androidApk?.size
    ).toBe(16456301)
  })

  it('без хеша APK не берётся: скачанное нечем сверить', () => {
    expect(parseReleaseApk([{ ...APK_ASSET, digest: null }], 'v0.11.2')).toBeNull()
    expect(parseReleaseApk([{ ...APK_ASSET, digest: 'sha1:abc' }], 'v0.11.2')).toBeNull()
  })

  it('файл не из этого релиза или не из этого репозитория — не берётся', () => {
    expect(parseReleaseApk([APK_ASSET], 'v0.11.3')).toBeNull()
    expect(
      parseReleaseApk(
        [
          {
            ...APK_ASSET,
            browser_download_url:
              'https://github.com/someone/fork/releases/download/v0.11.2/Android-Bastyon-NextGen-0.11.2.apk',
          },
        ],
        'v0.11.2'
      )
    ).toBeNull()
  })

  it('мусор и релиз без APK', () => {
    expect(parseReleaseApk(undefined, 'v0.11.2')).toBeNull()
    expect(parseReleaseApk(OTHER_ASSETS, 'v0.11.2')).toBeNull()
    expect(parseReleaseApk([{ ...APK_ASSET, size: 0 }], 'v0.11.2')).toBeNull()
    expect(parseReleaseApk([null, 'x', APK_ASSET], 'v0.11.2')?.size).toBe(16456301)
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
