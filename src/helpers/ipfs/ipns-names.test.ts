// Свои имена IPNS: ключ имени из ключа аккаунта не меняется между версиями
// (иначе у всех пропали бы постоянные ссылки), запись читается обратно,
// delegated routing спрашивается мимо кэша, а переиздание не откатывает
// имя, которое перевели с другого устройства.

import { hkdfSync } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ed25519PrivateKey } from './ipns-keys'
import {
  fetchRecord,
  getRecordBytes,
  nameKey,
  parseRecord,
  putRecord,
  renewal,
  RESIGN_BEFORE_MS,
  signRecord,
} from './ipns-names'
import { buildNameValue } from './ipfs-viewer'

const ACCOUNT = new Uint8Array(32).fill(7)
/** Имя №0 для ACCOUNT. Поменялось — у всех пропадут постоянные ссылки. */
const NAME_0 = 'k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff115356d77amfwc'
const VALUE = '/ipfs/bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm/report v2.pdf'
const NOW = Date.parse('2026-10-22T10:00:00Z')
const DAY = 86_400_000

function respond(status: number, type: string, body: string | Uint8Array | null = null) {
  return vi.fn(
    async () => new Response(body as BodyInit | null, { status, headers: { 'Content-Type': type } })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('nameKey', () => {
  it('HKDF-SHA256 от ключа аккаунта, метка bastyon/ipns, номер в info', () => {
    const seed = new Uint8Array(hkdfSync('sha256', ACCOUNT, 'bastyon/ipns', 'name/0', 32))
    expect(nameKey(ACCOUNT, 0).publicKey.toName()).toBe(
      new Ed25519PrivateKey(seed).publicKey.toName()
    )
    expect(nameKey(ACCOUNT, 0).publicKey.toName()).toBe(NAME_0)
  })

  it('у каждого номера своё имя, у другого аккаунта — другое', () => {
    const names = new Set([
      nameKey(ACCOUNT, 0).publicKey.toName(),
      nameKey(ACCOUNT, 1).publicKey.toName(),
      nameKey(new Uint8Array(32).fill(8), 0).publicKey.toName(),
    ])
    expect(names.size).toBe(3)
    expect(() => nameKey(ACCOUNT, -1)).toThrow(RangeError)
  })
})

describe('запись имени', () => {
  it('подписанная запись читается обратно', async () => {
    const signed = await signRecord(nameKey(ACCOUNT, 0), VALUE, 5n, NOW)
    const parsed = await parseRecord(NAME_0, signed.bytes)
    expect(parsed).toMatchObject({ name: NAME_0, value: VALUE, sequence: 5n })
    expect(parsed.validUntil.getTime()).toBe(NOW + 30 * DAY)
  })

  it('запись другого ключа под этим именем не принимается', async () => {
    const other = await signRecord(nameKey(ACCOUNT, 1), VALUE, 1n)
    await expect(parseRecord(NAME_0, other.bytes)).rejects.toThrow()
  })

  it('путь файла — без %-кодирования, как у Kubo', () => {
    expect(buildNameValue({ cid: 'bafyroot', name: 'report v2.pdf' })).toBe(
      '/ipfs/bafyroot/report v2.pdf'
    )
  })
})

describe('delegated routing', () => {
  it('GET мимо кэша CDN; «не найдено» кодом 200 с текстом и 404 — null', async () => {
    const text = respond(200, 'text/plain; charset=utf-8', 'routing: not found')
    vi.stubGlobal('fetch', text)
    expect(await getRecordBytes(NAME_0)).toBeNull()
    const [url, init] = text.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(
      new RegExp(`^https://delegated-ipfs.dev/routing/v1/ipns/${NAME_0}\\?t=\\d+$`)
    )
    expect(init.headers).toEqual({ Accept: 'application/vnd.ipfs.ipns-record' })

    vi.stubGlobal('fetch', respond(404, 'text/plain'))
    expect(await getRecordBytes(NAME_0)).toBeNull()
    vi.stubGlobal('fetch', respond(502, 'text/plain'))
    await expect(getRecordBytes(NAME_0)).rejects.toThrow('502')
  })

  it('найденная запись проверяется; чужая — как будто её нет', async () => {
    const own = await signRecord(nameKey(ACCOUNT, 0), VALUE, 3n)
    vi.stubGlobal('fetch', respond(200, 'application/vnd.ipfs.ipns-record', own.bytes))
    expect((await fetchRecord(NAME_0))?.sequence).toBe(3n)
    const forged = await signRecord(nameKey(ACCOUNT, 2), VALUE, 9n)
    vi.stubGlobal('fetch', respond(200, 'application/vnd.ipfs.ipns-record', forged.bytes))
    expect(await fetchRecord(NAME_0)).toBeNull()
  })

  it('PUT отправляет подписанные байты; отказ сервиса — ошибка', async () => {
    const record = await signRecord(nameKey(ACCOUNT, 0), VALUE, 1n)
    const ok = respond(200, 'text/plain')
    vi.stubGlobal('fetch', ok)
    await putRecord(record)
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://delegated-ipfs.dev/routing/v1/ipns/${NAME_0}`)
    expect(init).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/vnd.ipfs.ipns-record' },
      body: record.bytes,
    })
    vi.stubGlobal('fetch', respond(400, 'text/plain', 'bad record'))
    await expect(putRecord(record)).rejects.toThrow('400: bad record')
  })
})

describe('renewal', () => {
  const key = nameKey(ACCOUNT, 0)
  const known = { index: 0, value: VALUE, sequence: 4n }

  it('свежая запись из сети переиздаётся как есть', async () => {
    const network = await signRecord(key, VALUE, 4n, NOW)
    expect(await renewal(key, known, network, NOW + DAY)).toBe(network)
  })

  it('у старой записи — новая подпись и следующий номер', async () => {
    const network = await signRecord(key, VALUE, 4n, NOW)
    const later = NOW + 30 * DAY - RESIGN_BEFORE_MS + DAY
    const renewed = await renewal(key, known, network, later)
    expect(renewed).toMatchObject({ value: VALUE, sequence: 5n })
    expect(renewed?.validUntil.getTime()).toBe(later + 30 * DAY)
  })

  it('имя перевели с другого устройства — значение берётся из сети', async () => {
    const network = await signRecord(
      key,
      '/ipfs/bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu/v3.pdf',
      7n,
      NOW - 20 * DAY
    )
    expect(await renewal(key, known, network, NOW)).toMatchObject({
      value: '/ipfs/bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu/v3.pdf',
      sequence: 8n,
    })
  })

  it('в сети записи нет или она старее — подписывается своё значение', async () => {
    expect(await renewal(key, known, null, NOW)).toMatchObject({ value: VALUE, sequence: 5n })
    const older = await signRecord(
      key,
      '/ipfs/bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e/v1.pdf',
      2n,
      NOW
    )
    expect(await renewal(key, known, older, NOW)).toMatchObject({ value: VALUE, sequence: 5n })
    expect(await renewal(key, null, null, NOW)).toBeNull()
  })
})
