// latest.json релиза (scripts/updater-manifest.mjs): по обновлению на каждую
// систему, только из этого релиза и только с подписью — иначе приложение у
// пользователей отвергло бы манифест.

import { describe, expect, it } from 'vitest'

import { UPDATER_PLATFORMS, composeManifest } from '../../../scripts/updater-manifest.mjs'

const REPO = 'Vakutaghin/bastyon-nextgen'
const TAG = 'v0.9.4'
const url = (file) => `https://github.com/${REPO}/releases/download/${TAG}/${file}`

const ALL = [
  { 'darwin-aarch64': { signature: 'sig-arm\n', url: url('macOS-arm.app.tar.gz') } },
  { 'darwin-x86_64': { signature: 'sig-intel', url: url('macOS-intel.app.tar.gz') } },
  { 'linux-x86_64': { signature: 'sig-linux', url: url('Linux.AppImage') } },
  { 'windows-x86_64': { signature: 'sig-win', url: url('Windows.msi') } },
]

const compose = (fragments) =>
  composeManifest({ tag: TAG, repo: REPO, fragments, pubDate: '2026-10-01T12:00:00Z' })

describe('composeManifest', () => {
  it('версия без «v», ссылка на релиз, по записи на систему', () => {
    const manifest = compose(ALL)
    expect(manifest.version).toBe('0.9.4')
    expect(manifest.notes).toBe(`https://github.com/${REPO}/releases/tag/${TAG}`)
    expect(manifest.pub_date).toBe('2026-10-01T12:00:00Z')
    expect(Object.keys(manifest.platforms).sort()).toEqual([...UPDATER_PLATFORMS].sort())
    expect(manifest.platforms['darwin-aarch64']).toEqual({
      signature: 'sig-arm',
      url: url('macOS-arm.app.tar.gz'),
    })
  })

  it('системы не хватает — ошибка, а не неполный манифест', () => {
    expect(() => compose(ALL.slice(1))).toThrow('no update for darwin-aarch64')
  })

  it('без подписи, дважды или файл не из этого релиза — ошибка', () => {
    expect(() => compose([...ALL.slice(1), { 'darwin-aarch64': { url: url('a') } }])).toThrow(
      'no signature'
    )
    expect(() => compose([...ALL, ALL[0]])).toThrow('two updates for darwin-aarch64')
    const foreign = { 'darwin-aarch64': { signature: 's', url: 'https://evil.example/a.tar.gz' } }
    expect(() => compose([...ALL.slice(1), foreign])).toThrow('url outside v0.9.4')
  })
})
