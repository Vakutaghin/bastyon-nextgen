// Глобальный перехват кликов по IPFS-ссылкам (ipfs:// / ipns:// / /ipfs/<cid> /
// /ipns/<name>) и открытие их в отдельном нативном окне-просмотрщике (Tauri
// WebviewWindow). Один делегат на document ловит ссылки из любого места
// (v-html-контент постов, меншены, «о себе» и т.д.).
//
// Слушатель вешается ВЕЗДЕ (веб/десктоп). Решение о доступности и о том, каким
// шлюзом резолвить (локальная нода Tier 1 vs публичный шлюз Tier 0), принимает
// ipfs-store; в вебе показываем «только в приложении».
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
  type IpfsSecret,
  type IpfsTarget,
} from '@/helpers/ipfs/ipfs-link'
import { buildIpfsViewerUrl, IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'
import { classify, detectViewerOs, downloadFilename } from '@/helpers/ipfs/ipfs-content'
import { probeContent, saveIpfsResource } from '@/helpers/ipfs/ipfs-download'
import { useIpfsStore, type IpfsGatewaySource } from '@/stores/ipfs-store'
import { t } from '@/i18n'

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
 * Приватная ссылка: сохранить расшифрованный файл на диск (рендер неприменим).
 * Save-диалог и санитизация имени из НЕДОВЕРЕННОЙ ссылки — на стороне Rust
 * (`name=/Users/u/.ssh/authorized_keys` иначе открыл бы диалог прямо в ~/.ssh);
 * источник передаём как 'local' | 'public', URL Rust собирает сам.
 */
async function openEncrypted(
  store: IpfsStore,
  target: IpfsTarget,
  secret: IpfsSecret,
  gateway: string
): Promise<void> {
  const source: IpfsGatewaySource = gateway === IPFS_GATEWAY ? 'public' : 'local'
  const result = await store.saveEncrypted(source, target.root, secret.key, secret.name)
  if (result === 'saved') {
    Modal.success({ title: t('header.ipfsSaveDoneTitle') })
  } else if (result === 'failed') {
    Modal.error({ title: t('header.ipfsSaveFailedTitle'), content: store.message ?? '' })
  }
}

async function openIpfsViewer(target: IpfsTarget, secret: IpfsSecret | null): Promise<void> {
  const store = useIpfsStore()

  // Веб/мобилка: нативного окна и локальной ноды нет — фича только для десктопа.
  if (!store.available) {
    store.showDesktopOnly()
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
      await openEncrypted(store, target, secret, gateway)
      return
    }

    let url = buildIpfsViewerUrl(target, gateway)

    // Универсальный контент: пробуем тип и решаем render-vs-download, как браузер.
    let probed = await probeContent(url)

    // Per-CID fallback: локальная нода не отдала CID за таймаут (холодный swarm /
    // файрвол) → публичный шлюз (Tier 1 → Tier 0).
    if (!probed && gateway !== IPFS_GATEWAY) {
      if (torBlocked(store)) return
      url = buildIpfsViewerUrl(target, IPFS_GATEWAY)
      probed = await probeContent(url)
    }

    // Проба не удалась вовсе → показываем в окне (поведение не хуже прежнего).
    const mode = probed
      ? classify(probed.contentType, probed.contentDisposition, detectViewerOs())
      : 'render'
    if (mode === 'download') {
      if (torBlocked(store)) return
      try {
        await saveIpfsResource(url, downloadFilename(target, probed?.contentDisposition))
      } catch (err) {
        Modal.error({ title: t('header.ipfsSaveFailedTitle'), content: String(err) })
      }
      return
    }

    // Последняя проверка непосредственно перед окном без прокси.
    if (torBlocked(store)) return

    // Окно создаёт Rust: incognito (эфемерный storage — все IPFS-сайты на одном
    // origin), on_navigation по белому списку (наш gateway-порт / dweb.link),
    // повторный клик по открытому CID — фокус. URL проверяется там же.
    await store.openViewer(label, url, `IPFS · ${target.root.slice(0, 12)}…`)
  } catch (err) {
    console.error('[ipfs-viewer] ошибка открытия просмотрщика:', err)
  } finally {
    inFlight.delete(label)
  }
}

function findIpfsTargetFromClick(
  e: MouseEvent
): { target: IpfsTarget; secret: IpfsSecret | null } | null {
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
  return { target, secret }
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
  void openIpfsViewer(found.target, found.secret)
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
