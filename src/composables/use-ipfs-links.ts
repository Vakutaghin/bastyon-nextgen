// Глобальный перехват кликов по IPFS-ссылкам (ipfs:// / ipns:// / /ipfs/<cid> /
// /ipns/<name>) и открытие их в отдельном нативном окне-просмотрщике (Tauri
// WebviewWindow). Один делегат на document ловит ссылки из любого места
// (v-html-контент постов, меншены, «о себе» и т.д.).
//
// Слушатель вешается ВЕЗДЕ (веб/десктоп). Решение о доступности и о том, каким
// шлюзом резолвить (локальная нода Tier 1 vs публичный шлюз Tier 0), принимает
// ipfs-store; в вебе показываем «только в приложении».
import { onBeforeUnmount, onMounted } from 'vue'
import { parseIpfsLink, type IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import { buildIpfsViewerUrl, IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'
import { classify, detectViewerOs, downloadFilename } from '@/helpers/ipfs/ipfs-content'
import { probeContent, saveIpfsResource } from '@/helpers/ipfs/ipfs-download'
import { useIpfsStore } from '@/stores/ipfs-store'

/** Метка окна: одно окно на CID/имя (повторный клик — фокус, а не дубль). */
function windowLabel(target: IpfsTarget): string {
  const safe = target.root.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)
  return `ipfs-${target.namespace}-${safe}`
}

// Коалесинг конкурентных открытий одного и того же CID. Между getByLabel и
// созданием окна есть длинные await (resolveGateway/проба), поэтому двойной клик
// иначе прошёл бы дедуп и создал два окна с одной меткой / два save-диалога.
const inFlight = new Set<string>()

async function openIpfsViewer(target: IpfsTarget): Promise<void> {
  const store = useIpfsStore()

  // Веб/мобилка: нативного окна и локальной ноды нет — фича только для десктопа.
  if (!store.available) {
    store.showDesktopOnly()
    return
  }

  const label = windowLabel(target)
  if (inFlight.has(label)) return
  inFlight.add(label)

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

    // Повторный клик по уже открытому CID — просто фокус (без резолва/докачки).
    const existing = await WebviewWindow.getByLabel(label)
    if (existing) {
      await existing.setFocus()
      return
    }

    // Резолвим шлюз: локальная нода (с consent/установкой) либо публичный.
    const gateway = await store.resolveGateway()
    let url = buildIpfsViewerUrl(target, gateway)

    // Универсальный контент: пробуем тип и решаем render-vs-download, как браузер.
    let probed = await probeContent(url)

    // Per-CID fallback: локальная нода не отдала CID за таймаут (холодный swarm /
    // файрвол) → пробуем публичный шлюз (Tier 1 → Tier 0).
    if (!probed && gateway !== IPFS_GATEWAY) {
      url = buildIpfsViewerUrl(target, IPFS_GATEWAY)
      probed = await probeContent(url)
    }

    // Проба не удалась вовсе → показываем в окне (поведение не хуже прежнего).
    const mode = probed
      ? classify(probed.contentType, probed.contentDisposition, detectViewerOs())
      : 'render'
    if (mode === 'download') {
      await saveIpfsResource(url, downloadFilename(target, probed?.contentDisposition))
      return
    }

    const win = new WebviewWindow(label, {
      url,
      title: `IPFS · ${target.root.slice(0, 12)}…`,
      width: 1100,
      height: 780,
    })
    win.once('tauri://error', (e) => {
      console.error('[ipfs-viewer] не удалось открыть окно:', e)
    })
  } catch (err) {
    console.error('[ipfs-viewer] ошибка открытия просмотрщика:', err)
  } finally {
    inFlight.delete(label)
  }
}

function findIpfsTargetFromClick(e: MouseEvent): IpfsTarget | null {
  const start = e.target as HTMLElement | null
  const anchor = start?.closest?.('a')
  if (!anchor) return null
  // Сырой href важнее для scheme-формы (ipfs://…), .href — резолвнутый (path-форма).
  const raw = anchor.getAttribute('href') || ''
  return parseIpfsLink(raw) || parseIpfsLink(anchor.href || '')
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
  const target = findIpfsTargetFromClick(e)
  if (!target) return
  e.preventDefault()
  e.stopPropagation()
  void openIpfsViewer(target)
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
}
