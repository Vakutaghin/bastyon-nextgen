// Глобальный перехват кликов по IPFS-ссылкам (ipfs:// / ipns:// / /ipfs/<cid> /
// /ipns/<name>) и открытие их в отдельном нативном окне-просмотрщике (Tauri
// WebviewWindow). Один делегат на document ловит ссылки из любого места
// (v-html-контент постов, меншены, «о себе» и т.д.).
//
// Слушатель вешается ВЕЗДЕ (веб/десктоп). Решение о доступности и о том, каким
// шлюзом резолвить (локальная нода Tier 1 vs публичный шлюз Tier 0), принимает
// ipfs-store. В вебе и на телефоне ноды нет — там ссылку открывает
// ipfs-browser-open: показ через шлюз во вкладке, скачивание с проверкой по CID.
//
// Tor: IPFS НЕ торифицирован ни в одном звене — окно-просмотрщик грузит URL без
// прокси, а Kubo дозванивается DHT/Bitswap-пиров напрямую и светит реальный IP
// вместе с запрашиваемым CID. Поэтому под Tor не открываем ВООБЩЕ (ни локально,
// ни через публичный шлюз), а флаг перечитываем после каждого await — он мог
// включиться, пока шли consent/установка (до 10 мин).
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import {
  parseIpfsLink,
  parseIpfsSecret,
  parseIpfsSize,
  type IpfsSecret,
  type IpfsTarget,
} from '@/helpers/ipfs/ipfs-link'
import { buildIpfsViewerUrl, IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'
import { classify, detectViewerOs, downloadFilename } from '@/helpers/ipfs/ipfs-content'
import { probeContent } from '@/helpers/ipfs/ipfs-download'
import { useIpfsStore, type IpfsGatewaySource, type IpfsSaveProgress } from '@/stores/ipfs-store'
import { Z_INDEX } from '@/styles/design-tokens'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { t } from '@/i18n'
import { openIpfsInBrowser } from './ipfs-browser-open'

/** FNV-1a 32-bit → 8 hex: дешёвый стабильный хэш строки для меток окон. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Метка окна: одно окно на CID/имя (повторный клик — фокус, а не дубль).
 * Хвост — хэш ПОЛНОГО корня: одна лишь очистка от `.`/`-` склеивала бы
 * `en.wikipedia-on-ipfs.org` и `enwikipedia-on-ipfs.org` в одну метку.
 */
export function windowLabel(target: IpfsTarget): string {
  const safe = target.root.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)
  return `ipfs-${target.namespace}-${safe}-${fnv1a(target.root)}`
}

// Коалесинг конкурентных открытий одного и того же CID. Между getByLabel и
// созданием окна есть длинные await (resolveGateway/проба), поэтому двойной клик
// иначе прошёл бы дедуп и создал два окна с одной меткой / два save-диалога.
const inFlight = new Set<string>()

type IpfsStore = ReturnType<typeof useIpfsStore>

/**
 * true = Tor включён → показали модалку, продолжать нельзя. Вызывать ПОСЛЕ каждого
 * await (а не по снимку до него): consent/установка/диалог могут длиться минуты.
 */
function torBlocked(store: IpfsStore): boolean {
  if (!store.torActive) return false
  store.showTorBlocked()
  return true
}

/**
 * Текст ошибки сохранения: коды проверки по CID из Rust (verify.rs) — по-русски,
 * остальное (сеть, диск) — как есть.
 */
export function saveErrorText(message: string | null): string {
  const m = message ?? ''
  if (m.startsWith('verify-mismatch')) return t('header.ipfsVerifyMismatch')
  if (m.startsWith('verify-unsupported')) return t('header.ipfsVerifyUnsupported')
  if (m.startsWith('verify-too-large')) return t('header.ipfsVerifyTooLarge')
  if (m.startsWith('verify-missing')) return t('header.ipfsVerifyIncomplete')
  return m
}

/**
 * Окно прогресса сохранения: появляется, когда место выбрано (первый отчёт
 * Rust), и даёт отменить. Закрывается по завершении — дальше итоговое окно.
 */
function saveProgressWindow(): {
  onProgress: (progress: IpfsSaveProgress) => void
  close: () => void
} {
  let modal: ReturnType<typeof Modal.info> | null = null
  const text = (p: IpfsSaveProgress): string => {
    // Шлюз может искать файл в сети минуту — это не зависание.
    if (p.received === 0) return t('header.ipfsSaveWaiting')
    const done = formatFileSize(p.total ? Math.min(p.received, p.total) : p.received)
    return p.total
      ? t('header.ipfsWebProgress', { done, total: formatFileSize(p.total) })
      : t('header.ipfsSaveProgress', { done })
  }
  return {
    onProgress: (p) => {
      if (modal) {
        modal.update({ content: text(p) })
        return
      }
      modal = Modal.info({
        zIndex: Z_INDEX.MODAL,
        title: t('header.ipfsWebDownloadingTitle'),
        content: text(p),
        okText: t('header.ipfsSaveCancel'),
        onOk: () => p.cancel(),
      })
    },
    close: () => modal?.destroy(),
  }
}

/**
 * Обычный (не приватный) файл — на диск. Через публичный шлюз Rust собирает
 * его из CAR с проверкой каждого блока по CID; с локальной ноды — потоком.
 */
async function saveFile(
  store: IpfsStore,
  source: IpfsGatewaySource,
  target: IpfsTarget,
  suggestedName: string,
  size: number | null
): Promise<void> {
  const progress = saveProgressWindow()
  const result = await store.saveFile(source, target, suggestedName, {
    sizeHint: size,
    onProgress: progress.onProgress,
  })
  progress.close()
  if (result === 'saved') {
    Modal.success({ title: t('header.ipfsSaveDoneTitle') })
  } else if (result === 'failed') {
    Modal.error({
      title: t('header.ipfsDownloadFailedTitle'),
      content: saveErrorText(store.message),
    })
  }
}

/**
 * Приватная ссылка: сохранить расшифрованный файл на диск (рендер неприменим).
 * Save-диалог и санитизация имени из НЕДОВЕРЕННОЙ ссылки — на стороне Rust
 * (`name=/Users/u/.ssh/authorized_keys` иначе открыл бы диалог прямо в ~/.ssh);
 * источник передаём как 'local' | 'public', URL Rust собирает сам.
 */
async function openEncrypted(
  store: IpfsStore,
  target: IpfsTarget,
  secret: IpfsSecret,
  gateway: string,
  size: number | null
): Promise<void> {
  const source: IpfsGatewaySource = gateway === IPFS_GATEWAY ? 'public' : 'local'
  const progress = saveProgressWindow()
  const result = await store.saveEncrypted(source, target.root, secret.key, secret.name, {
    sizeHint: size,
    onProgress: progress.onProgress,
  })
  progress.close()
  if (result === 'saved') {
    Modal.success({ title: t('header.ipfsSaveDoneTitle') })
  } else if (result === 'failed') {
    Modal.error({ title: t('header.ipfsSaveFailedTitle'), content: store.message ?? '' })
  }
}

/** Открыть IPFS-ссылку; `size` — размер из самой ссылки, если он там есть. */
export async function openIpfsViewer(
  target: IpfsTarget,
  secret: IpfsSecret | null,
  size: number | null = null
): Promise<void> {
  const store = useIpfsStore()

  // Веб/мобилка: нативного окна и локальной ноды нет. Вызов синхронный — вкладку
  // для показа браузер откроет, только пока идёт обработка клика.
  if (!store.available) {
    openIpfsInBrowser(target, secret, size)
    return
  }

  // Под Tor — сразу отказ, до consent/запуска ноды (см. шапку файла).
  if (torBlocked(store)) return

  const label = windowLabel(target)
  if (inFlight.has(label)) return
  inFlight.add(label)

  try {
    // Резолвим шлюз: локальная нода (с consent/установкой) либо публичный.
    const gateway = await store.resolveGateway()
    if (torBlocked(store)) return

    // Приватная (зашифрованная) ссылка: тянем шифртекст, расшифровываем в Rust,
    // сохраняем на диск. Рендер в окне тут неприменим (сырые байты — шифр).
    if (secret?.key) {
      await openEncrypted(store, target, secret, gateway, size)
      return
    }

    let source: IpfsGatewaySource = gateway === IPFS_GATEWAY ? 'public' : 'local'
    let url = buildIpfsViewerUrl(target, gateway)

    // Универсальный контент: пробуем тип и решаем render-vs-download, как браузер.
    let probed = await probeContent(url)

    // Per-CID fallback: локальная нода не отдала CID за таймаут (холодный swarm /
    // файрвол) → публичный шлюз (Tier 1 → Tier 0).
    if (!probed && source === 'local') {
      if (torBlocked(store)) return
      source = 'public'
      url = buildIpfsViewerUrl(target, IPFS_GATEWAY)
      probed = await probeContent(url)
    }

    // Проба не удалась вовсе → показываем в окне (поведение не хуже прежнего).
    const mode = probed
      ? classify(probed.contentType, probed.contentDisposition, detectViewerOs())
      : 'render'
    if (mode === 'download') {
      if (torBlocked(store)) return
      await saveFile(
        store,
        source,
        target,
        downloadFilename(target, probed?.contentDisposition),
        size
      )
      return
    }

    // Последняя проверка непосредственно перед окном без прокси.
    if (torBlocked(store)) return

    // Окно создаёт Rust: incognito (эфемерный storage — все IPFS-сайты на одном
    // origin), on_navigation по белому списку (наш gateway-порт / dweb.link),
    // повторный клик по открытому CID — фокус. URL проверяется там же.
    // Показ через публичный шлюз по CID не проверяется (в отличие от
    // сохранения) — заголовок окна честно называет шлюз.
    const via = source === 'public' ? ` · ${new URL(IPFS_GATEWAY).host}` : ''
    await store.openViewer(label, url, `IPFS · ${target.root.slice(0, 12)}…${via}`)
  } catch (err) {
    console.error('[ipfs-viewer] ошибка открытия просмотрщика:', err)
  } finally {
    inFlight.delete(label)
  }
}

function findIpfsTargetFromClick(
  e: MouseEvent
): { target: IpfsTarget; secret: IpfsSecret | null; size: number | null } | null {
  const start = e.target as HTMLElement | null
  const anchor = start?.closest?.('a')
  if (!anchor) return null
  // Сырой href важнее для scheme-формы (ipfs://…), .href — резолвнутый (path-форма).
  const raw = anchor.getAttribute('href') || ''
  const resolved = anchor.href || ''
  const target = parseIpfsLink(raw) || parseIpfsLink(resolved)
  if (!target) return null
  // Секрет (#key=..) берём из сырого href — резолвнутый может потерять фрагмент.
  const secret = parseIpfsSecret(raw) || parseIpfsSecret(resolved)
  return { target, secret, size: parseIpfsSize(raw) ?? parseIpfsSize(resolved) }
}

// Активность перехвата (по умолчанию — всегда). На embed-роутах модалки нет,
// поэтому там перехват выключаем, чтобы клик не «проваливался» без фидбека.
let isActive: () => boolean = () => true

function handleClick(e: MouseEvent): void {
  if (!isActive()) return
  // Только простой левый клик без модификаторов (Ctrl/Cmd-клик и пр. не трогаем).
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return
  }
  const found = findIpfsTargetFromClick(e)
  if (!found) return
  e.preventDefault()
  e.stopPropagation()
  void openIpfsViewer(found.target, found.secret, found.size)
}

/**
 * Вешает глобальный перехват IPFS-ссылок. `active` (по умолчанию true) позволяет
 * отключить перехват там, где нет singleton-модалки (embed-роуты) — иначе клик
 * был бы поглощён без визуального фидбека/зависал бы на неотрендеренной модалке.
 */
export function useIpfsLinks(active: () => boolean = () => true): void {
  isActive = active
  onMounted(() => {
    document.addEventListener('click', handleClick, true)
    // Подписка на события бэкенда + подтягивание статуса (no-op в вебе).
    if (isActive()) {
      useIpfsStore()
        .hydrate()
        .catch(() => {})
    }
  })
  onBeforeUnmount(() => document.removeEventListener('click', handleClick, true))

  // Tor включили при работающей ноде — гасим её: фоновые DHT/Bitswap-соединения
  // Kubo идут в обход Tor и светят реальный IP всё время, пока демон жив.
  const store = useIpfsStore()
  watch(
    () => store.torActive,
    (on) => {
      if (on && store.status === 'running') void store.stop()
    }
  )
}
