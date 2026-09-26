// Файл с публичного шлюза с проверкой по CID — для веба и телефона. Шлюз
// отдаёт CAR (блоки по пути и сам файл), проверка — в ipfs-verify.ts.
//
// Запрос идёт прямо на trustless-gateway.link: dweb.link отвечает на
// ?format=car редиректом туда же, но без CORS-заголовков, и браузер такой
// редирект не пропускает (проверено 26.09.2026). Параметры CAR — в URL, а не в
// Accept: запрос остаётся простым, без preflight.
import { CarBlockIterator } from '@ipld/car/iterator'
import { appFetch } from '@/helpers/api/fetch-strategies'
import type { IpfsTarget } from './ipfs-link'
import { GatewayError, TransportError, VerifyError, isAbortError } from './ipfs-errors'
import { BlockReader, openEntity, parseCid, type Entity } from './ipfs-verify'

export const TRUSTLESS_GATEWAY = 'https://trustless-gateway.link'

/** При order=dfs вне очереди приходят единичные блоки (лишние шарды по пути). */
const STRAY_BLOCKS_MAX = 32 * 1024 * 1024
/** Тишина в ответе дольше минуты — обрыв, как read_timeout в Rust. */
const IDLE_TIMEOUT_MS = 60_000
/** Сколько первых байт файла нужно, чтобы понять его тип. */
const SNIFF_BYTES = 512

/**
 * Сегменты пути ссылки (как в href, с %-кодированием) → имена в каталогах.
 * Отвергает то же, что SaveTarget::parse в Rust: `.`, `..`, слэши внутри
 * имени и управляющие символы.
 */
export function pathSegments(path: string): string[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((raw) => {
      let name: string
      try {
        name = decodeURIComponent(raw)
      } catch {
        throw new VerifyError('malformed', 'bad path')
      }
      // eslint-disable-next-line no-control-regex
      if (name === '.' || name === '..' || /[/\\\x00-\x1f\x7f]/.test(name)) {
        throw new VerifyError('malformed', 'bad path')
      }
      return name
    })
}

export function carUrl(root: string, segments: readonly string[]): string {
  const path = segments.map(encodeURIComponent).join('/')
  const params = 'format=car&dag-scope=entity&car-version=1&car-order=dfs&car-dups=y'
  return `${TRUSTLESS_GATEWAY}/ipfs/${root}${path ? `/${path}` : ''}?${params}`
}

/** Таймер тишины: каждый кусок ответа откладывает обрыв. */
function idleWatch(controller: AbortController) {
  let fired = false
  const fire = (): void => {
    fired = true
    controller.abort()
  }
  let timer = setTimeout(fire, IDLE_TIMEOUT_MS)
  return {
    get fired(): boolean {
      return fired
    },
    kick(): void {
      clearTimeout(timer)
      timer = setTimeout(fire, IDLE_TIMEOUT_MS)
    },
    stop(): void {
      clearTimeout(timer)
    },
  }
}

type IdleWatch = ReturnType<typeof idleWatch>

/** Сбой сети или тишина → TransportError; отмена пользователем проходит как есть. */
function transportFailure(e: unknown, idle: IdleWatch): unknown {
  if (idle.fired) return new TransportError('timeout', 'the gateway went silent')
  if (isAbortError(e) || e instanceof VerifyError) return e
  return new TransportError('network', e instanceof Error ? e.message : String(e))
}

async function* readBody(
  body: ReadableStream<Uint8Array>,
  idle: IdleWatch,
  onBytes?: (received: number) => void
): AsyncGenerator<Uint8Array, void, undefined> {
  const reader = body.getReader()
  let received = 0
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (e) {
        throw transportFailure(e, idle)
      }
      if (chunk.done) return
      idle.kick()
      received += chunk.value.length
      onBytes?.(received)
      yield chunk.value
    }
  } finally {
    idle.stop()
    reader.cancel().catch(() => {})
  }
}

export interface FetchEntityOptions {
  /** Отмена пользователем: обрывает и запрос, и чтение. */
  signal?: AbortSignal
  /** Потолок размера файла. */
  maxBytes: number
  /** Потолок памяти, если шлюз не выдержал order=dfs, dups=y и блоки пришлось копить. */
  maxReorderBytes: number
  /** Сколько байт ответа уже пришло. */
  onBytes?: (received: number) => void
}

/**
 * Каталог или файл по IPFS-ссылке, собранный из проверенных блоков. Файл
 * читается потоком по мере потребления `chunks`.
 */
export async function fetchVerifiedEntity(
  target: IpfsTarget,
  opts: FetchEntityOptions
): Promise<Entity> {
  // IPNS-имя через шлюз ничем не подписано (DNSLink) — проверить нечем.
  if (target.namespace !== 'ipfs') throw new VerifyError('unsupported', 'IPNS name')
  const root = parseCid(target.root)
  const segments = pathSegments(target.path)

  const controller = new AbortController()
  const idle = idleWatch(controller)
  opts.signal?.addEventListener(
    'abort',
    () => {
      idle.stop()
      controller.abort()
    },
    { once: true }
  )
  if (opts.signal?.aborted) controller.abort()

  let res: Response
  try {
    res = await appFetch(carUrl(root.toString(), segments), {
      signal: controller.signal,
      credentials: 'omit',
    })
  } catch (e) {
    idle.stop()
    throw transportFailure(e, idle)
  }
  if (!res.ok) {
    idle.stop()
    throw new GatewayError(res.status)
  }
  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('application/vnd.ipld.car') || !res.body) {
    idle.stop()
    throw new VerifyError('unsupported', 'the gateway did not return a CAR')
  }
  // Шлюз подтверждает порядок в Content-Type. Без него блоки копятся в памяти.
  const streamed = /\border=dfs\b/.test(type) && /\bdups=y\b/.test(type)

  let blocks: CarBlockIterator
  try {
    blocks = await CarBlockIterator.fromIterable(readBody(res.body, idle, opts.onBytes))
  } catch (e) {
    if (e instanceof TransportError || isAbortError(e)) throw e
    throw new VerifyError('malformed', 'not a CAR')
  }
  const reader = new BlockReader(blocks[Symbol.asyncIterator](), {
    keepConsumed: !streamed,
    maxBuffered: streamed ? STRAY_BLOCKS_MAX : opts.maxReorderBytes,
  })
  return openEntity(reader, root, segments, opts.maxBytes)
}

export type EntityInfo = { kind: 'directory' } | { kind: 'file'; size: number; head: Uint8Array }

/**
 * Что по ссылке: каталог или файл — с размером и первыми байтами, чтобы
 * решить, показать его или скачать. Запрос после этого обрывает вызывающий
 * (отменой `signal`).
 */
export async function inspectEntity(target: IpfsTarget, signal: AbortSignal): Promise<EntityInfo> {
  const entity = await fetchVerifiedEntity(target, {
    signal,
    maxBytes: Number.MAX_SAFE_INTEGER,
    maxReorderBytes: STRAY_BLOCKS_MAX,
  })
  if (entity.kind === 'directory') return entity
  const first = await entity.chunks.next()
  const head = first.done ? new Uint8Array() : first.value.slice(0, SNIFF_BYTES)
  return { kind: 'file', size: entity.size, head }
}
