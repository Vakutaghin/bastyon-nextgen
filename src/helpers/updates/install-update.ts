/**
 * Обновление изнутри приложения на компьютере (Tauri updater).
 *
 * Плагин берёт latest.json последнего релиза, проверяет подпись minisign
 * открытым ключом из tauri.conf.json (plugins.updater), скачивает сборку для
 * этой системы и ставит её поверх. Скачанное приложением macOS карантином не
 * помечает, поэтому «Всё равно открыть» не спрашивается, а постоянная подпись
 * сборок (scripts/macos-signing-key.sh) снимает вопрос связки ключей и
 * повторные запросы микрофона.
 *
 * При включённом Tor проверка и загрузка идут через его SOCKS, как и
 * остальные запросы (V20, fail-closed): пока Tor не готов — ждём, упал —
 * ошибка, а не прямое соединение.
 */

import { TorNotReadyError, torRoutingMode, waitForTorRouting } from '@/helpers/tor/tor-gate'

export interface InstallProgress {
  phase: 'download' | 'install'
  /** Скачанная доля 0…1; `null` — сервер не назвал размер. */
  fraction: number | null
}

/**
 * `restarting` — новая версия стоит, приложение перезапускается;
 * `unavailable` — в релизе нет обновления для этой системы (или оно не новее).
 */
export type InstallResult = 'restarting' | 'unavailable'

/** latest.json маленький, но под Tor первый запрос идёт долго. */
const CHECK_TIMEOUT_MS = 60_000

async function updaterProxy(): Promise<string | undefined> {
  let mode = await torRoutingMode()
  if (mode === 'wait') mode = await waitForTorRouting()
  if (mode === 'failed') {
    throw new TorNotReadyError(
      'failed',
      'Tor is enabled but failed; refusing a direct update download'
    )
  }
  if (mode !== 'tor') return undefined
  const { useTorStore } = await import('@/stores/tor-store')
  // socks5h: имена хостов тоже разрешает Tor, а не системный DNS.
  return `socks5h://127.0.0.1:${useTorStore().socksPort}`
}

/** Скачивает и ставит обновление, затем перезапускает приложение. */
export async function installUpdate(
  onProgress: (progress: InstallProgress) => void
): Promise<InstallResult> {
  const proxy = await updaterProxy()
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check({ timeout: CHECK_TIMEOUT_MS, ...(proxy ? { proxy } : {}) })
  if (!update) return 'unavailable'

  let total: number | null = null
  let received = 0
  onProgress({ phase: 'download', fraction: null })
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength || null
      onProgress({ phase: 'download', fraction: total ? 0 : null })
    } else if (event.event === 'Progress') {
      received += event.data.chunkLength
      onProgress({ phase: 'download', fraction: total ? Math.min(1, received / total) : null })
    } else {
      onProgress({ phase: 'install', fraction: 1 })
    }
  })

  // macOS и Linux: новая версия уже на месте, запускаем её. Windows сам
  // закрывает приложение, когда стартует установщик.
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
  return 'restarting'
}
