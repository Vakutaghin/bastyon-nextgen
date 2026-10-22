// Узел IPFS прямо в браузере (Helia) — в вебе, в приложении на телефоне и на
// компьютере без модуля IPFS. Содержимое качается у других узлов сети без
// шлюзов: по WebRTC, WebSocket с TLS и у узлов с HTTPS-адресом. Каждый блок
// проверяет и Helia, и ipfs-verify.ts.
//
// Узел один на вкладку: создаётся при первой ссылке и останавливается, когда
// несколько минут не нужен. Входящих соединений не принимает: раздавать из
// браузера нечего, а открытый узел подсказывал бы другим, что здесь скачивали.
//
// Модуль тяжёлый (~400 КБ gzip): грузить только динамическим import(). Под Tor
// его не грузят вовсе: узлы сети видят настоящий IP.
import { createHelia, type Helia } from 'helia'
import {
  dnsLink,
  type DNSLink,
  type DNSLinkIPFSResult,
  type DNSLinkIPNSResult,
} from '@helia/dnslink'
import { ipnsResolver, type IPNSResolver } from '@helia/ipns'
import { base32 } from 'multiformats/bases/base32'
import { base58btc } from 'multiformats/bases/base58'
import type { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import type { MultihashDigest } from 'multiformats/hashes/interface'
import type { IpfsTarget } from './ipfs-link'
import { DELEGATED_ROUTERS } from './ipfs-network'
import {
  NameError,
  NodeUnavailableError,
  TransportError,
  VerifyError,
  isAbortError,
} from './ipfs-errors'
import { compatKeychain } from './ipns-keys'
import {
  listDirectory,
  openEntity,
  parseCid,
  pathSegments,
  statEntry,
  type BlockSource,
  type Entity,
} from './ipfs-verify'

export { listDirectory, statEntry }
export type { DirEntry, DirListing, Entity, EntryStat } from './ipfs-verify'

/** Узел без дела столько времени останавливается: держать десятки соединений незачем. */
const IDLE_STOP_MS = 5 * 60_000
/** Столько ждём, чтобы пришёл хоть один блок; дольше — «в сети не нашлось». */
const STALL_TIMEOUT_MS = 60_000
/** Скачанное Helia складывает в хранилище; в памяти держим только последние блоки. */
const RECENT_BLOCKS_BYTES = 32 * 1024 * 1024
/** Сколько блоков одной ссылки качается одновременно. */
const MAX_AHEAD = 16
/**
 * Блок не пришёл за это время через сессию — параллельно просим его без
 * сессии, с новым поиском источников, и повторяем, пока ждём.
 */
const RESCUE_AFTER_MS = 6_000
const RESCUE_RETRY_MS = 10_000
/** codec libp2p-key: так в CID записан ключ имени IPNS. */
const LIBP2P_KEY = 0x72

type Store = NonNullable<NonNullable<Parameters<typeof createHelia>[0]>['blockstore']>
type BlockBytes = Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>

async function concat(bytes: BlockBytes): Promise<Uint8Array> {
  if (bytes instanceof Uint8Array) return bytes
  const parts: Uint8Array[] = []
  for await (const part of bytes) parts.push(part)
  if (parts.length === 1) return parts[0] as Uint8Array
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function notFound(): Error {
  const e = new Error('block not in the store')
  e.name = 'NotFoundError'
  return e
}

/**
 * Хранилище блоков с потолком: самые старые уходят первыми. Без потолка файл
 * на гигабайт занял бы гигабайт памяти вкладки — блоки нужны обходу один раз.
 */
class RecentBlocks {
  private readonly blocks = new Map<string, { cid: CID; bytes: Uint8Array }>()
  private total = 0

  constructor(private readonly maxBytes: number) {}

  private key(cid: CID): string {
    return base32.encode(cid.multihash.bytes)
  }

  has(cid: CID): boolean {
    return this.blocks.has(this.key(cid))
  }

  async put(cid: CID, bytes: BlockBytes): Promise<CID> {
    const block = await concat(bytes)
    const key = this.key(cid)
    if (this.blocks.has(key) || block.length > this.maxBytes) return cid
    this.blocks.set(key, { cid, bytes: block })
    this.total += block.length
    for (const [old, entry] of this.blocks) {
      if (this.total <= this.maxBytes) break
      this.blocks.delete(old)
      this.total -= entry.bytes.length
    }
    return cid
  }

  async *get(cid: CID): AsyncGenerator<Uint8Array> {
    const entry = this.blocks.get(this.key(cid))
    if (!entry) throw notFound()
    yield entry.bytes
  }

  async delete(cid: CID): Promise<void> {
    const key = this.key(cid)
    const entry = this.blocks.get(key)
    if (!entry) return
    this.blocks.delete(key)
    this.total -= entry.bytes.length
  }

  async *putMany(
    source:
      | Iterable<{ cid: CID; bytes: BlockBytes }>
      | AsyncIterable<{ cid: CID; bytes: BlockBytes }>
  ): AsyncGenerator<CID> {
    for await (const { cid, bytes } of source) yield await this.put(cid, bytes)
  }

  async *getMany(cids: Iterable<CID> | AsyncIterable<CID>) {
    for await (const cid of cids) yield { cid, bytes: this.get(cid) }
  }

  async *deleteMany(cids: Iterable<CID> | AsyncIterable<CID>): AsyncGenerator<CID> {
    for await (const cid of cids) {
      await this.delete(cid)
      yield cid
    }
  }

  async *getAll() {
    for (const { cid, bytes } of [...this.blocks.values()]) {
      yield {
        cid,
        bytes: (async function* () {
          yield bytes
        })(),
      }
    }
  }
}

interface Node {
  helia: Helia
  ipns: IPNSResolver
  dnslink: DNSLink
}

let node: Promise<Node> | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined

/** Узел нужен: откладывает остановку. */
function touch(): void {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => void stopNode(), IDLE_STOP_MS)
}

/** Остановить узел: закрыть соединения. Следующая ссылка запустит его заново. */
export async function stopNode(): Promise<void> {
  clearTimeout(idleTimer)
  const current = node
  node = null
  if (!current) return
  try {
    await (await current).helia.stop()
  } catch {
    // Не запустился или уже остановлен.
  }
}

function getNode(): Promise<Node> {
  touch()
  node ??= startNode().catch((e: unknown) => {
    node = null
    throw e
  })
  return node
}

async function startNode(): Promise<Node> {
  try {
    const helia = await createHelia({
      blockstore: new RecentBlocks(RECENT_BLOCKS_BYTES) as unknown as Store,
      // Запасные шлюзы Helia по умолчанию — trustless-gateway.link и 4everland:
      // первый не отвечает, второй уводит на поддомен. Блоки — только от узлов.
      http: { delegatedRouters: [...DELEGATED_ROUTERS], recursiveGateways: [] },
      libp2p: { addresses: { listen: [] } },
    })
    // createHelia узел не запускает, а без запуска нет и libp2p.
    await helia.start()
    // Подпись имени проверяет noble, а не WebCrypto: см. ipns-keys.ts.
    const ipns = ipnsResolver({
      datastore: helia.datastore,
      routing: helia.routing,
      logger: helia.logger,
      keychain: compatKeychain(helia.keychain),
    })
    return { helia, ipns, dnslink: dnsLink(helia) }
  } catch (e) {
    throw new NodeUnavailableError(e instanceof Error ? e.message : String(e))
  }
}

function abortError(signal: AbortSignal): unknown {
  if (signal.reason instanceof Error && signal.reason.name === 'AbortError') return signal.reason
  return new DOMException('The operation was aborted.', 'AbortError')
}

type BlockStore = Pick<Helia['blockstore'], 'get'>

/**
 * Блоки одной ссылки. Сначала из сессии Helia: узлы, у которых нашёлся
 * корень, первыми спрашиваются и про остальные блоки — так быстрее всего.
 *
 * Но сессия выкидывает источник, чей запрос отменили, — даже когда отменили
 * потому, что блок раньше прислал другой. Так из сессии пропадают HTTP-узлы,
 * которые раздают, например, Википедию, и обратно она их не берёт: следующий
 * блок не приходил вовсе (проверено 21.10.2026). Поэтому блок, который не
 * пришёл за несколько секунд, параллельно просится без сессии — с новым
 * поиском источников именно этого блока, — а для следующих блоков сессия
 * создаётся заново.
 *
 * Если ни один блок не приходит минуту — «в сети не нашлось»: ждать дальше
 * бессмысленно, а окно висело бы.
 */
class SessionBlocks implements BlockSource {
  private session: BlockStore
  private sessionBorn = Date.now()
  private readonly ahead = new Map<string, Promise<Uint8Array>>()
  private lastProgress = Date.now()

  constructor(
    private readonly helia: Helia,
    private readonly root: CID,
    private readonly signal: AbortSignal
  ) {
    this.session = helia.blockstore.createSession(root, { signal })
  }

  get(cid: CID): Promise<Uint8Array> {
    const key = cid.toString()
    const ahead = this.ahead.get(key)
    if (!ahead) return this.fetch(cid)
    this.ahead.delete(key)
    return ahead
  }

  prefetch(cids: readonly CID[]): void {
    for (const cid of cids) {
      if (this.ahead.size >= MAX_AHEAD) return
      const key = cid.toString()
      if (this.ahead.has(key)) continue
      const pending = this.fetch(cid)
      // Ошибку получит тот, кто попросит блок; брошенный запрос — не ошибка.
      pending.catch(() => {})
      this.ahead.set(key, pending)
    }
  }

  /** Новая сессия — не чаще, чем раз в RESCUE_AFTER_MS: выкинутые источники снова в деле. */
  private renewSession(): void {
    if (Date.now() - this.sessionBorn < RESCUE_AFTER_MS) return
    this.session = this.helia.blockstore.createSession(this.root, { signal: this.signal })
    this.sessionBorn = Date.now()
  }

  private async fetch(cid: CID): Promise<Uint8Array> {
    if (this.signal.aborted) throw abortError(this.signal)
    const controllers: AbortController[] = []
    const attempt = (store: BlockStore): Promise<Uint8Array> => {
      const controller = new AbortController()
      controllers.push(controller)
      return concat(store.get(cid, { signal: controller.signal }))
    }
    // Отмена и долгая тишина обрывают все попытки сразу.
    let halt!: (e: unknown) => void
    const halted = new Promise<never>((_, reject) => (halt = reject))
    halted.catch(() => {})
    let done = false
    const stop = (reason: unknown): void => {
      done = true
      controllers.forEach((c) => c.abort())
      halt(reason)
    }
    const onAbort = (): void => stop(abortError(this.signal))
    this.signal.addEventListener('abort', onAbort, { once: true })

    let watchTimer: ReturnType<typeof setTimeout> | undefined
    const watch = (): void => {
      const quiet = Date.now() - this.lastProgress
      if (quiet >= STALL_TIMEOUT_MS) {
        stop(new TransportError('timeout', `no one sent block ${cid.toString()}`))
        return
      }
      watchTimer = setTimeout(watch, STALL_TIMEOUT_MS - quiet)
    }
    watch()

    let rescueTimer: ReturnType<typeof setTimeout> | undefined
    const viaSession = attempt(this.session)
    const rescue = new Promise<Uint8Array>((resolve) => {
      let started = false
      const tryAgain = (): void => {
        if (done) return
        started = true
        this.renewSession()
        attempt(this.helia.blockstore).then(resolve, () => {
          rescueTimer = setTimeout(tryAgain, RESCUE_RETRY_MS)
        })
      }
      rescueTimer = setTimeout(tryAgain, RESCUE_AFTER_MS)
      // Сессия сдалась сама (не нашла источников) — не ждём.
      viaSession.catch(() => {
        if (started) return
        clearTimeout(rescueTimer)
        tryAgain()
      })
    })
    try {
      const bytes = await Promise.race([Promise.any([viaSession, rescue]), halted])
      this.lastProgress = Date.now()
      touch()
      return bytes
    } finally {
      done = true
      clearTimeout(watchTimer)
      clearTimeout(rescueTimer)
      controllers.forEach((c) => c.abort())
      this.signal.removeEventListener('abort', onAbort)
    }
  }
}

/** Куда ведёт имя: для подписи в окне просмотра. */
export interface NameInfo {
  /** ipns — подписанная запись IPNS; dnslink — запись в DNS домена. */
  kind: 'ipns' | 'dnslink'
  name: string
  /** Путь, на который указывает имя: `/ipfs/<cid>/…`. */
  value: string
  /** До когда действительна подписанная запись IPNS. */
  validUntil: Date | null
}

interface Resolved {
  root: CID
  segments: string[]
  name: NameInfo | null
}

/** Ключ имени IPNS: `k51…`/`bafz…` (CID libp2p-key) или `12D3Koo…`/`Qm…` (base58). */
function ipnsKey(name: string): MultihashDigest {
  try {
    if (/^(1|Qm)/.test(name)) return Digest.decode(base58btc.baseDecode(name))
    const cid = parseCid(name)
    if (cid.code === LIBP2P_KEY) return cid.multihash
  } catch {
    // ниже — общий отказ
  }
  throw new VerifyError('malformed', `not an IPNS name: ${name.slice(0, 64)}`)
}

/** RFC 3339 с наносекундами → Date (Safari не разбирает больше трёх знаков дроби). */
function validity(bytes: Uint8Array | undefined): Date | null {
  if (!bytes?.length) return null
  const text = new TextDecoder().decode(bytes).replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function ipfsPath(value: string): { root: CID; segments: string[] } {
  const m = /^\/ipfs\/([^/]+)(\/.*)?$/.exec(value)
  if (!m?.[1]) throw new NameError('invalid', `the name points to ${value.slice(0, 80)}`)
  return { root: parseCid(m[1]), segments: pathSegments(m[2] ?? '') }
}

function nameFailure(e: unknown, signal: AbortSignal): unknown {
  if (signal.aborted) return abortError(signal)
  if (isAbortError(e) || e instanceof VerifyError || e instanceof NameError) return e
  const message = e instanceof Error ? e.message : String(e)
  if (e instanceof Error && e.name === 'RecordsFailedValidationError') {
    return new NameError('invalid', message)
  }
  return new NameError('not-found', message)
}

async function resolveIpns(
  n: Node,
  key: MultihashDigest,
  signal: AbortSignal
): Promise<{ root: CID; segments: string[]; value: string; validUntil: Date | null }> {
  let last: { value: string; record: { validity?: Uint8Array } } | undefined
  try {
    // Имя может вести на другое имя — резолвер проходит цепочку, нужен её конец.
    for await (const step of n.ipns.resolve(key, { signal })) last = step
  } catch (e) {
    throw nameFailure(e, signal)
  }
  if (!last) throw new NameError('not-found', 'empty IPNS resolution')
  return { ...ipfsPath(last.value), value: last.value, validUntil: validity(last.record.validity) }
}

async function resolveDnsLink(n: Node, domain: string, signal: AbortSignal): Promise<Resolved> {
  let results: Awaited<ReturnType<DNSLink['resolve']>>
  try {
    results = await n.dnslink.resolve(domain, { signal })
  } catch (e) {
    throw nameFailure(e, signal)
  }
  for (const result of results) {
    if (result.namespace === 'ipfs') {
      const { cid, path } = result as DNSLinkIPFSResult
      const value = `/ipfs/${cid.toString()}${path}`
      return {
        root: cid,
        segments: pathSegments(path),
        name: { kind: 'dnslink', name: domain, value, validUntil: null },
      }
    }
    if (result.namespace === 'ipns') {
      const { value: key, path } = result as DNSLinkIPNSResult
      const inner = await resolveIpns(n, key, signal)
      return {
        root: inner.root,
        segments: [...inner.segments, ...pathSegments(path)],
        name: { kind: 'dnslink', name: domain, value: inner.value + path, validUntil: null },
      }
    }
  }
  throw new NameError('not-found', `no DNSLink record for ${domain}`)
}

async function resolveTarget(n: Node, target: IpfsTarget, signal: AbortSignal): Promise<Resolved> {
  const rest = pathSegments(target.path)
  if (target.namespace === 'ipfs') {
    return { root: parseCid(target.root), segments: rest, name: null }
  }
  // Имя с точкой — домен с DNSLink, иначе ключ IPNS.
  if (target.root.includes('.')) {
    const resolved = await resolveDnsLink(n, target.root, signal)
    return { ...resolved, segments: [...resolved.segments, ...rest] }
  }
  const resolved = await resolveIpns(n, ipnsKey(target.root), signal)
  return {
    root: resolved.root,
    segments: [...resolved.segments, ...rest],
    name: {
      kind: 'ipns',
      name: target.root,
      value: resolved.value,
      validUntil: resolved.validUntil,
    },
  }
}

export interface Opened {
  entity: Entity
  /** Куда вело имя (ipns:// и DNSLink); null — ссылка прямо на CID. */
  name: NameInfo | null
  /** Блоки этой ссылки — для списка папки и записей в ней. */
  source: BlockSource
}

export interface OpenOptions {
  /** Отмена: обрывает поиск и скачивание. Когда файл больше не нужен — тоже отменять. */
  signal: AbortSignal
  /** Потолок размера файла. */
  maxBytes: number
}

/**
 * Что по ссылке: каталог или файл, собранный из проверенных блоков. Файл
 * читается потоком по мере потребления `chunks`.
 */
export async function openIpfs(target: IpfsTarget, opts: OpenOptions): Promise<Opened> {
  const n = await getNode()
  const resolved = await resolveTarget(n, target, opts.signal)
  const source = new SessionBlocks(n.helia, resolved.root, opts.signal)
  const entity = await openEntity(source, resolved.root, resolved.segments, opts.maxBytes)
  return { entity, name: resolved.name, source }
}
