// @vitest-environment node
// Живая проверка против настоящего шлюза (нужна сеть), без IPFS_LIVE пропускается:
//   IPFS_LIVE=1 node_modules/.bin/vitest run src/helpers/ipfs/ipfs-gateway-car.live.test.ts
// Те же файлы, что в живых тестах Rust (src-tauri/src/ipfs/mod.rs).

import { describe, expect, it } from 'vitest'
import { carUrl, fetchVerifiedEntity } from './ipfs-gateway-car'
import type { IpfsTarget } from './ipfs-link'

const opts = { maxBytes: 64 << 20, maxReorderBytes: 64 << 20 }

async function download(target: IpfsTarget): Promise<Uint8Array> {
  const entity = await fetchVerifiedEntity(target, opts)
  if (entity.kind !== 'file') throw new Error('not a file')
  const parts: Uint8Array[] = []
  for await (const chunk of entity.chunks) parts.push(chunk)
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  parts.reduce((offset, p) => (out.set(p, offset), offset + p.length), 0)
  return out
}

describe.skipIf(!process.env.IPFS_LIVE)('trustless-gateway.link', () => {
  // docs.ipfs.tech: images/welcome-to-IPFS.jpg — путь через два каталога.
  const image: IpfsTarget = {
    namespace: 'ipfs',
    root: 'bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm',
    path: 'images/welcome-to-IPFS.jpg',
  }

  it('шлюз соблюдает порядок обхода с повторами — файл идёт потоком', async () => {
    const res = await fetch(carUrl(image.root, image.path.split('/')))
    await res.body?.cancel()
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.ipld.car; version=1; order=dfs; dups=y'
    )
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  }, 120_000)

  it('картинка собирается и проверяется', async () => {
    const bytes = await download(image)
    expect(bytes.length).toBe(663_082)
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]) // JPEG
  }, 120_000)

  it('страница через шардированные каталоги Википедии', async () => {
    const bytes = await download({
      namespace: 'ipfs',
      root: 'bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze',
      path: 'wiki/Main_Page/index.html',
    })
    expect(new TextDecoder().decode(bytes)).toContain('Wikipedia')
  }, 120_000)
})
