import { describe, expect, it } from 'vitest'
import {
  builtInToInstalled,
  doInstall,
  ownFetchHosts,
  remoteEntryToInstalled,
} from './apps-installer'
import type { ParsedManifest } from '../types/manifest'
import type { ManifestLoader } from '../registry/manifest-loader'

const MANIFEST: ParsedManifest = {
  id: 'user.app',
  name: 'User app',
  version: 1,
  versionText: '0.0.1',
  description: '',
  descriptions: {},
  author: '',
  develop: false,
  permissions: [],
  fetchHosts: ['https://api.example.com'],
}

// S44: без allowlist fetch-tunnel падал TypeError'ом, а под Tor (весь fetch
// идёт через туннель) приложение не могло сделать ни одного запроса.
describe('fetchHosts у приложений без загруженного манифеста (S44)', () => {
  it('built-in получает собственный origin', () => {
    const app = builtInToInstalled({
      id: 'barteron.pocketnet.app',
      scope: 'barteron.club',
      name: 'Barteron',
      version: '1.0.0',
      cantdelete: true,
    })

    expect(app.manifest.fetchHosts).toEqual(['https://barteron.club'])
  })

  it('built-in с testnet-scope и доп. хостами получает все', () => {
    const app = builtInToInstalled({
      id: 'x.app',
      scope: 'x.app',
      tscope: 'test.x.app',
      name: 'X',
      version: '1.0.0',
      cantdelete: true,
      fetchHosts: ['https://api.x.app'],
    })

    expect(app.manifest.fetchHosts).toEqual([
      'https://x.app',
      'https://test.x.app',
      'https://api.x.app',
    ])
  })

  it('каталожная запись получает собственный origin', () => {
    const app = remoteEntryToInstalled({ id: 'game.app', name: 'Game', scope: 'game.app' })

    expect(app.manifest.fetchHosts).toEqual(['https://game.app'])
  })

  it('установка по манифесту добавляет свой origin к объявленному allowlist', async () => {
    const loader = { load: async () => MANIFEST } as unknown as ManifestLoader
    const app = await doInstall(loader, 'user.com', {})

    expect(app.manifest.fetchHosts).toEqual(['https://user.com', 'https://api.example.com'])
  })

  it('невалидный scope не попадает в allowlist', () => {
    expect(ownFetchHosts('   ')).toEqual([])
  })
})
