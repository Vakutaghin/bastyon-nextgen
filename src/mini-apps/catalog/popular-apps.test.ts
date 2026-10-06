import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RemoteAppsLoader, type RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import { SHELF_SIZE, loadPopularApps, pickShelfApps, resetPopularAppsCache } from './popular-apps'

function entry(id: string, rating: number, tags: string[] = []): RemoteAppEntry {
  return { id, name: id, scope: `${id}.example.com`, rating, tags }
}

beforeEach(() => resetPopularAppsCache())

describe('полка популярных сервисов', () => {
  it('без VPN, без приложений с нулевым и плохим рейтингом и без двойников встроенных', () => {
    const picked = pickShelfApps([
      entry('radio', 113, ['music']),
      entry('vpn', 90, ['vpn']),
      entry('meh', 0),
      entry('bad', -3),
      { ...entry('fake', 50), name: 'Barteron' },
      { ...entry('fake2', 40), scope: 'barteron.club' },
      entry('tetris', 29, ['игры']),
    ])
    expect(picked.map((a) => a.id)).toEqual(['radio', 'tetris'])
  })

  it('не больше SHELF_SIZE плиток', () => {
    const many = Array.from({ length: 30 }, (_, i) => entry(`a${i}`, 100 - i))
    expect(pickShelfApps(many)).toHaveLength(SHELF_SIZE)
  })

  it('просит у ноды сортировку по рейтингу и держит ответ в памяти', async () => {
    const rpc = vi.fn(async () => [{ id: 'radio', name: 'Radio', scope: 'r.example.com' }])
    const loader = new RemoteAppsLoader(rpc)
    const getLoader = async () => loader
    // Рейтинга во «плоском» ответе нет — такое приложение на полку не берём.
    expect(await loadPopularApps(getLoader)).toEqual([])
    await loadPopularApps(getLoader)
    expect(rpc).toHaveBeenCalledTimes(1)
    const [, params] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(params.orderBy).toBe('rating')
    expect(params.orderDesc).toBe(true)
  })

  it('ошибка ноды не запоминается: следующий заход спросит снова', async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([
        { s2: 'radio', s1: 'a', p: { s1: '{"n":"Radio","s":"r.example.com"}' }, ad: { r: 5 } },
      ])
    const loader = new RemoteAppsLoader(rpc)
    await expect(loadPopularApps(async () => loader)).rejects.toThrow('offline')
    const apps = await loadPopularApps(async () => loader)
    expect(apps.map((a) => a.id)).toEqual(['radio'])
  })
})
