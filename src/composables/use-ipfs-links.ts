// Глобальный перехват кликов по IPFS-ссылкам (ipfs:// / ipns:// / /ipfs/<cid> /
// /ipns/<name>) и открытие их в отдельном нативном окне-просмотрщике (Tauri
// WebviewWindow). Работает только в Tauri; в вебе/мобилке — no-op (ссылки идут
// обычным путём). Один делегат на document ловит ссылки из любого места
// (v-html-контент постов, меншены, «о себе» и т.д.).
//
// Движок IPFS (какой URL грузить) изолирован в ipfs-viewer.buildIpfsViewerUrl —
// см. комментарий там про gateway vs встроенная нода.
import { onBeforeUnmount, onMounted } from 'vue'
import { parseIpfsLink, type IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import { buildIpfsViewerUrl } from '@/helpers/ipfs/ipfs-viewer'
import { classify, detectViewerOs, downloadFilename } from '@/helpers/ipfs/ipfs-content'
import { probeContent, saveIpfsResource } from '@/helpers/ipfs/ipfs-download'

/** Tauri v2/v1: наличие рантайма. Минимальная проверка, чтобы не тянуть
 *  зависимость от feature-утилит в core-композабл. */
function inTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_INTERNALS__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

/** Метка окна: одно окно на CID/имя (повторный клик — фокус, а не дубль). */
function windowLabel(target: IpfsTarget): string {
  const safe = target.root.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)
  return `ipfs-${target.namespace}-${safe}`
}

async function openIpfsViewer(target: IpfsTarget): Promise<void> {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const label = windowLabel(target)

    // Повторный клик по уже открытому CID — просто фокус (без пробы/докачки).
    const existing = await WebviewWindow.getByLabel(label)
    if (existing) {
      await existing.setFocus()
      return
    }

    const url = buildIpfsViewerUrl(target)

    // Универсальный контент: пробуем тип и решаем render-vs-download, как браузер.
    // Проба не удалась → показываем в окне (поведение не хуже прежнего).
    const probed = await probeContent(url)
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

function handleClick(e: MouseEvent): void {
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

export function useIpfsLinks(): void {
  if (!inTauri()) return
  onMounted(() => document.addEventListener('click', handleClick, true))
  onBeforeUnmount(() => document.removeEventListener('click', handleClick, true))
}
