import { describe, it, expect, vi } from 'vitest'
import { RemoteAppsLoader } from './remote-registry'

describe('RemoteAppsLoader', () => {
  it('calls rpc("getapps") with default parameters', async () => {
    const rpc = vi.fn(async () => [])
    const loader = new RemoteAppsLoader(rpc)
    await loader.load()

    expect(rpc).toHaveBeenCalledOnce()
    const [method, params] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(method).toBe('getapps')
    expect(params.pageStart).toBe(0)
    expect(params.pageSize).toBe(20)
    expect(params.search).toBe('')
    expect(params.tags).toEqual([])
    expect(params.orderBy).toBe('height')
    expect(params.orderDesc).toBe(true)
    // topHeight отсутствует по умолчанию
    expect('topHeight' in params).toBe(false)
  })

  it('merges custom parameters with defaults', async () => {
    const rpc = vi.fn(async () => [])
    const loader = new RemoteAppsLoader(rpc)
    await loader.load({ search: 'barter', pageStart: 40, pageSize: 10, topHeight: 999 })

    const [, params] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(params.search).toBe('barter')
    expect(params.pageStart).toBe(40)
    expect(params.pageSize).toBe(10)
    expect(params.topHeight).toBe(999)
  })

  it('normalizes flat-format items with id+name+scope', async () => {
    const raw = [
      { id: 'a.app', name: 'Alpha', scope: 'a.example.com' },
      { id: 'b.app', name: 'Beta', scope: 'b.example.com', icon: 'https://custom.icon.png' },
    ]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()

    expect(page.apps).toHaveLength(2)
    expect(page.apps[0]?.icon).toBe('https://a.example.com/b_icon.png')
    expect(page.apps[1]?.icon).toBe('https://custom.icon.png')
  })

  it('normalizes wire-format items from pocketnet node', async () => {
    const raw = [
      {
        s1: 'PW4P7bBjxSFtAAAeDWwMki6PzFm2L4jE3P',
        s2: 'tetris.amurkupon.app',
        p: {
          s1: '{"n":"Тетрис","s":"tetris.amurkupon.ru","ts":"localhost:8080","d":"desc","t":["игры","тетрис"]}',
          s2: 'tetris.amurkupon.app',
        },
        height: 3844318,
      },
    ]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()

    expect(page.apps).toHaveLength(1)
    expect(page.apps[0]).toMatchObject({
      id: 'tetris.amurkupon.app',
      name: 'Тетрис',
      scope: 'tetris.amurkupon.ru',
      description: 'desc',
      tags: ['игры', 'тетрис'],
      author: 'PW4P7bBjxSFtAAAeDWwMki6PzFm2L4jE3P',
      height: 3844318,
    })
    expect(page.apps[0]?.icon).toBe('https://tetris.amurkupon.ru/b_icon.png')
  })

  it('filters out "[object Object]" description bug', async () => {
    const raw = [
      {
        s2: 'bug.app',
        s1: 'PW4P7bBjxSFtAAAeDWwMki6PzFm2L4jE3P',
        p: { s1: '{"n":"Buggy","s":"buggy.com","d":"[object Object]","t":[]}' },
      },
    ]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()
    expect(page.apps[0]?.description).toBeUndefined()
  })

  it('skips wire-format entry with broken JSON in p.s1', async () => {
    const raw = [
      { s2: 'broken.app', p: { s1: 'not json' } },
      { s2: 'ok.app', s1: 'a', p: { s1: '{"n":"OK","s":"ok.com"}' } },
    ]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()
    expect(page.apps.map((a) => a.id)).toEqual(['ok.app'])
  })

  it('unwraps {result, data} envelope from node', async () => {
    const envelope = {
      result: 'success',
      data: [{ s2: 'one.app', s1: 'auth', p: { s1: '{"n":"One","s":"one.com"}' } }],
      time: { rpcsend: 12.3 },
    }
    const loader = new RemoteAppsLoader(async () => envelope)
    const page = await loader.load()
    expect(page.apps.map((a) => a.id)).toEqual(['one.app'])
  })

  it('throws when envelope has result: error', async () => {
    const envelope = { result: 'error', error: 'node_busy' }
    const loader = new RemoteAppsLoader(async () => envelope)
    await expect(loader.load()).rejects.toThrow('node_busy')
  })

  it('extracts name from manifest.name when top-level name missing', async () => {
    const raw = [{ id: 'm.app', manifest: { name: 'Manifested' }, scope: 'm.example.com' }]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()
    expect(page.apps[0]?.name).toBe('Manifested')
  })

  it('drops entries without id/name/scope', async () => {
    const raw = [
      { id: 'ok.app', name: 'OK', scope: 'ok.com' },
      { id: '', name: 'NoId', scope: 'x.com' },
      { id: 'no-name', scope: 'y.com' },
      { id: 'no-scope.app', name: 'NoScope' },
      null,
      'garbage',
    ]
    const loader = new RemoteAppsLoader(async () => raw as unknown[])
    const page = await loader.load()
    expect(page.apps.map((a) => a.id)).toEqual(['ok.app'])
  })

  it('returns empty array for non-array response', async () => {
    const loader = new RemoteAppsLoader(async () => null)
    const page = await loader.load()
    expect(page.apps).toEqual([])
  })

  it('hasMore is true when page is full', async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => ({
      id: `app${i}.app`,
      name: `App ${i}`,
      scope: `a${i}.com`,
    }))
    const loader = new RemoteAppsLoader(async () => fullPage)
    const page = await loader.load()
    expect(page.hasMore).toBe(true)
  })

  it('hasMore is false when page is partial', async () => {
    const partial = [{ id: 'one.app', name: 'One', scope: 'one.com' }]
    const loader = new RemoteAppsLoader(async () => partial)
    const page = await loader.load({ pageSize: 20 })
    expect(page.hasMore).toBe(false)
  })

  it('preserves optional fields', async () => {
    const raw = [
      {
        id: 'full.app',
        name: 'Full',
        scope: 'full.com',
        description: 'desc',
        address: 'addr',
        author: 'PR7...',
        tags: ['games', 'utility'],
        height: 12345,
      },
    ]
    const loader = new RemoteAppsLoader(async () => raw)
    const page = await loader.load()
    expect(page.apps[0]).toMatchObject({
      description: 'desc',
      address: 'addr',
      author: 'PR7...',
      tags: ['games', 'utility'],
      height: 12345,
    })
  })

  it('propagates rpc errors', async () => {
    const loader = new RemoteAppsLoader(async () => {
      throw new Error('rpc_down')
    })
    await expect(loader.load()).rejects.toThrow('rpc_down')
  })
})
