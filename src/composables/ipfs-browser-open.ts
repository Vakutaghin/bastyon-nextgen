// Открытие IPFS-ссылок в браузере и на телефоне, где нет локальной ноды и Rust.
// Обычная ссылка — новая вкладка inbrowser.link: содержимое из сети качает и
// проверяет сам браузер (service worker), он же решает, показать или скачать.
// Публичные шлюзы с сентября 2026 приложениям не отвечают (ipfs-viewer.ts),
// поэтому раньше здешние проба типа и скачивание из CAR перестали работать.
//
// Приватный файл скачивается здесь: файл собирается из CAR, каждый блок
// сверяется со своим CID (ipfs-verify.ts) и расшифровывается ключом из ссылки.
// Библиотеки IPLD грузятся только при скачивании (динамический import).
import { h, type VNode } from 'vue'
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { Z_INDEX } from '@/styles/design-tokens'
import { openExternal } from '@/helpers/common/open-external'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import type { IpfsSecret, IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import { buildIpfsWebUrl } from '@/helpers/ipfs/ipfs-viewer'
import { sanitizeFilename } from '@/helpers/ipfs/ipfs-content'
import { extensionFor } from '@/helpers/ipfs/ipfs-sniff'
import {
  GatewayError,
  SecretError,
  TransportError,
  VerifyError,
  isAbortError,
} from '@/helpers/ipfs/ipfs-errors'
import { openSaveSink, type SaveSink, type SinkKind } from '@/helpers/ipfs/ipfs-save-sinks'

/** Старые приватные файлы (v1) расшифровываются целиком в памяти — как MAX_ENCRYPTED_BYTES в Rust. */
const SECRET_V1_MAX_BYTES = 512 * 1024 * 1024 + 28
/** Если шлюз прислал блоки не по порядку, столько можем держать в памяти. */
const REORDER_MAX_BYTES = 256 * 1024 * 1024
/** Расшифрованный файл уходит на запись такими кусками. */
const WRITE_SLICE_BYTES = 4 * 1024 * 1024
/** Прогресс в окне обновляется не чаще. */
const PROGRESS_INTERVAL_MS = 250
/** Окна скачивания открыл сам пользователь — выше автоматических («Что нового»). */
const MODAL_Z = Z_INDEX.MODAL

// Повторный клик по той же ссылке, пока идёт первый, не открывает второе окно.
const inFlight = new Set<string>()

interface DownloadRequest {
  name: string
  size?: number
  secret?: IpfsSecret
}

/**
 * Имя для сохранения: из ссылки (только базовое имя — `../x` из чужой ссылки
 * не должен стать путём), а для голого CID — по угаданному типу.
 */
function fileName(name: string, target: IpfsTarget, type?: string): string {
  const clean = sanitizeFilename(name.split(/[/\\]/).pop() ?? '')
  if (clean) return clean
  const ext = (type && extensionFor(type)) || 'bin'
  return `${sanitizeFilename(target.root).slice(0, 16) || 'ipfs'}.${ext}`
}

function track(key: string, work: Promise<void>): void {
  inFlight.add(key)
  void work.finally(() => inFlight.delete(key))
}

/**
 * Клик по IPFS-ссылке в браузере или на телефоне. Синхронно: вкладку браузер
 * откроет, только пока идёт обработка клика.
 */
export function openIpfsInBrowser(
  target: IpfsTarget,
  secret: IpfsSecret | null,
  size: number | null = null
): void {
  if (!secret?.key) {
    void openExternal(buildIpfsWebUrl(target))
    return
  }
  const key = `${target.root}/${target.path}`
  if (inFlight.has(key)) return
  track(
    key,
    download(target, { name: fileName(secret.name, target), size: size ?? undefined, secret })
  )
}

function describe(req: DownloadRequest): VNode {
  const title = req.size ? `${req.name} · ${formatFileSize(req.size)}` : req.name
  const hint = req.secret ? t('header.ipfsWebPrivateHint') : t('header.ipfsWebVerifyHint')
  return h('div', [h('div', { style: { wordBreak: 'break-all' } }, title), h('div', hint)])
}

/** Окно «Скачать?»; по «Скачать» — выбор места и скачивание с прогрессом в том же окне. */
function download(target: IpfsTarget, req: DownloadRequest): Promise<void> {
  return new Promise((done) => {
    const controller = new AbortController()
    const modal = Modal.confirm({
      zIndex: MODAL_Z,
      title: t(req.secret ? 'header.ipfsWebPrivateTitle' : 'header.ipfsWebDownloadTitle'),
      content: describe(req),
      okText: t('header.ipfsWebDownloadBtn'),
      cancelText: t('common.cancel'),
      onCancel: () => {
        controller.abort()
        done()
      },
      onOk: async () => {
        // Диалог сохранения — первым делом: браузер пускает его только по клику.
        const sink = await openSaveSink(req.name)
        if (!sink) {
          done()
          return
        }
        modal.update({ title: t('header.ipfsWebDownloadingTitle') })
        try {
          await runDownload(target, req, sink, controller.signal, (content) =>
            modal.update({ content })
          )
          if (sink.kind !== 'share') appToast.success({ message: t('header.ipfsSaveDoneTitle') })
        } catch (e) {
          await sink.abort()
          if (!isAbortError(e)) showError(e, sink.kind, Boolean(req.secret))
        } finally {
          done()
        }
      },
    })
  })
}

function progressReporter(show: (content: string) => void) {
  let last = 0
  return (done: number, total: number): void => {
    const now = Date.now()
    if (now - last < PROGRESS_INTERVAL_MS && done < total) return
    last = now
    show(t('header.ipfsWebProgress', { done: formatFileSize(done), total: formatFileSize(total) }))
  }
}

async function runDownload(
  target: IpfsTarget,
  req: DownloadRequest,
  sink: SaveSink,
  signal: AbortSignal,
  show: (content: string) => void
): Promise<void> {
  const { fetchVerifiedEntity } = await import('@/helpers/ipfs/ipfs-gateway-car')
  const entity = await fetchVerifiedEntity(target, {
    signal,
    // Шифр v2 добавляет 16 байт на мегабайт — запас в 1/64 000 с лихвой.
    maxBytes: req.secret ? sink.maxBytes + Math.ceil(sink.maxBytes / 65_536) + 1024 : sink.maxBytes,
    maxReorderBytes: REORDER_MAX_BYTES,
  })
  if (entity.kind === 'directory') throw new VerifyError('directory')
  const progress = progressReporter(show)
  const counted = (async function* () {
    let received = 0
    for await (const chunk of entity.chunks) {
      received += chunk.length
      progress(received, entity.size)
      yield chunk
    }
  })()
  if (req.secret) {
    await saveSecret(entity.size, counted, req.secret, sink, show)
    return
  }
  for await (const chunk of counted) await sink.write(chunk)
  await sink.close()
}

/** Первый кусок отдельно (по нему узнаётся формат), остальные — как шли. */
async function peek(
  chunks: AsyncGenerator<Uint8Array>
): Promise<{ head: Uint8Array; all: AsyncGenerator<Uint8Array> }> {
  const first = await chunks.next()
  const head = first.done ? new Uint8Array() : first.value
  const all = (async function* () {
    if (head.length) yield head
    yield* chunks
  })()
  return { head, all }
}

/**
 * Приватный файл. Формат v2 расшифровывается потоком прямо в место
 * сохранения; старый v1 (одним куском GCM) — только целиком, до 512 МБ.
 */
async function saveSecret(
  size: number,
  chunks: AsyncGenerator<Uint8Array>,
  secret: IpfsSecret,
  sink: SaveSink,
  show: (content: string) => void
): Promise<void> {
  const secretModule = await import('@/helpers/ipfs/ipfs-secret')
  const { head, all } = await peek(chunks)
  if (secretModule.isStreamFormat(head)) {
    for await (const plain of secretModule.decryptSecretStream(secret.key, all, sink.maxBytes)) {
      await sink.write(plain)
    }
    await sink.close()
    return
  }
  if (size > SECRET_V1_MAX_BYTES) throw new VerifyError('too-large')
  const blob = new Uint8Array(size)
  let offset = 0
  for await (const chunk of all) {
    if (offset + chunk.length > blob.length) {
      throw new VerifyError('malformed', 'the file is larger than its root says')
    }
    blob.set(chunk, offset)
    offset += chunk.length
  }
  if (offset !== blob.length) {
    throw new VerifyError('malformed', 'the file is shorter than its root says')
  }
  show(t('header.ipfsWebDecrypting'))
  const plain = await secretModule.decryptSecretFile(secret.key, blob)
  if (plain.length > sink.maxBytes) throw new VerifyError('too-large')
  for (let i = 0; i < plain.length; i += WRITE_SLICE_BYTES) {
    await sink.write(plain.subarray(i, i + WRITE_SLICE_BYTES))
  }
  await sink.close()
}

/**
 * Текст ошибки для пользователя: что случилось и что с этим делать. Потолок
 * в 1 ГБ — только у сохранения через Blob; у приватных файлов свой, меньше.
 */
export function webErrorText(e: unknown, sink: SinkKind | null, secret = false): string {
  if (e instanceof GatewayError) {
    if (e.status === 429) return t('header.ipfsWebGatewayBusy')
    if (e.status === 404 || e.status === 410) return t('header.ipfsWebNotFound')
    if (e.status >= 500) return t('header.ipfsWebGatewayMissing')
    return e.message
  }
  if (e instanceof TransportError) {
    return t(e.reason === 'timeout' ? 'header.ipfsWebGatewayMissing' : 'header.ipfsWebNetwork')
  }
  if (e instanceof SecretError) return t('header.ipfsWebDecryptFailed')
  if (e instanceof VerifyError) {
    switch (e.code) {
      case 'mismatch':
        return t('header.ipfsVerifyMismatch')
      case 'missing':
        return t('header.ipfsWebIncomplete')
      case 'not-found':
        return t('header.ipfsWebNotFound')
      case 'directory':
        return t('header.ipfsWebDirectory')
      case 'malformed':
        return t('header.ipfsWebMalformed')
      case 'too-large':
        return t(
          sink === 'blob' && !secret ? 'header.ipfsWebTooLargeForBrowser' : 'header.ipfsWebTooLarge'
        )
      default:
        return t('header.ipfsWebUnsupported')
    }
  }
  return e instanceof Error ? e.message : String(e)
}

function showError(e: unknown, sink: SinkKind | null, secret = false): void {
  Modal.error({
    zIndex: MODAL_Z,
    title: t('header.ipfsDownloadFailedTitle'),
    content: webErrorText(e, sink, secret),
  })
}
