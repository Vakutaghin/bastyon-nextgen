/**
 * Что уходит в поддержку по кнопке «Сведения о приложении» в чате с ней.
 *
 * Только то, что помогает понять ошибку: версия и платформа, система, экран,
 * язык, настройки, от которых зависит работа, к чему подключено приложение и
 * последние ошибки (с вырезанными адресами, см. recent-errors). Ни ключей,
 * ни фразы восстановления, ни адреса и имени (поддержка и так видит, кто
 * пишет), ни переписки, контактов, страниц, где человек был.
 */

import { Capacitor } from '@capacitor/core'

import { CURRENT_APP_VERSION } from '@/helpers/changelog/changelog-loader'
import { currentProxy } from '@/helpers/api/node-selector'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { isTauriEnv } from '@/helpers/api/request-tor'
import { recentErrors, scrubForReport, type RecentError } from '@/helpers/diagnostics/recent-errors'
import { i18n } from '@/i18n'
import { useTheme } from '@/composables/use-theme'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { useTorStore } from '@/stores/tor-store'
import type { GetNodeInfoResponse } from '@/types/rpc-responses/get-node-info'
import { matrixService } from '../services/matrix-service'
import { useMessengerUiStore } from '../store/messenger-ui-store'

export const SUPPORT_REPORT_KIND = 'bastyon-nextgen-support'

export interface SupportReportData {
  report: typeof SUPPORT_REPORT_KIND
  generatedAt: string
  /** Сдвиг часов человека от UTC — чтобы сопоставить «сломалось в 14:00». */
  utcOffset: string
  app: {
    version: string
    /** Сборка: production, development. */
    build: string
    platform: 'desktop' | 'android' | 'ios' | 'web'
    /** Сайт установлен как приложение (PWA). */
    installed?: boolean
    /** Сколько минут открыто приложение. */
    uptimeMin: number
  }
  system: {
    name?: string
    version?: string
    arch?: string
    /** Модель телефона (Android). */
    model?: string
    userAgent: string
  }
  screen: {
    size: string
    window: string
    pixelRatio: number
    touch: boolean
    cores?: number
    memoryGb?: number
  }
  language: { app: string; system: string[] }
  settings: {
    theme: string
    uiScale: number
    animations: boolean
    chatButton: boolean
    tor: string
  }
  network: {
    online: boolean
    connection?: string
    /** Прокси-нода, через которую идут запросы. */
    node?: string
    /** Нода за прокси, её версия и последний блок: отстала ли от сети. */
    nodeServer?: string
    nodeVersion?: string
    blockHeight?: number
    blockAgeMin?: number
    chatServer?: string
    chatSync: string
    chatSyncError?: string
  }
  storage?: { usedMb: number; quotaMb: number; persisted?: boolean }
  errors: RecentError[]
}

interface TauriSystemInfo {
  os: string
  name: string
  version: string
  arch: string
}

interface UaDataValues {
  platform?: string
  platformVersion?: string
  architecture?: string
  bitness?: string
  model?: string
}

interface UaData {
  getHighEntropyValues?: (hints: string[]) => Promise<UaDataValues>
}

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

async function safeAsync<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch {
    return fallback
  }
}

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

function platform(): SupportReportData['app']['platform'] {
  if (isTauriEnv()) return 'desktop'
  const native = safe(() => Capacitor.getPlatform(), 'web')
  return native === 'android' || native === 'ios' ? native : 'web'
}

async function systemInfo(isDesktop: boolean): Promise<SupportReportData['system']> {
  const userAgent = safe(() => navigator.userAgent, '')
  if (isDesktop) {
    const info = await safeAsync(async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<TauriSystemInfo>('system_info')
    }, null)
    if (info) return { name: info.name, version: info.version, arch: info.arch, userAgent }
  }
  // Chromium (Android, WebView2, Chrome) отдаёт настоящую версию системы и
  // модель только так: в строке агента они давно заморожены.
  const uaData = safe(
    () => (navigator as Navigator & { userAgentData?: UaData }).userAgentData,
    undefined
  )
  const values = await safeAsync(
    async () =>
      (await uaData?.getHighEntropyValues?.([
        'platformVersion',
        'architecture',
        'bitness',
        'model',
      ])) ?? null,
    null
  )
  if (!values) return { userAgent }
  const arch = [values.architecture, values.bitness].filter(Boolean).join('-')
  return {
    name: values.platform || undefined,
    version: values.platformVersion || undefined,
    arch: arch || undefined,
    model: values.model || undefined,
    userAgent,
  }
}

/** `bootstrapping (auto, webtunnel)`: статус, режим мостов и чем идёт подключение. */
function torSummary(tor: ReturnType<typeof useTorStore>): string {
  const via = tor.activeTransport ? `, ${tor.activeTransport}` : ''
  return `${tor.status} (${tor.bridgeKind}${via})`
}

async function storage(): Promise<SupportReportData['storage']> {
  const est = await safeAsync(() => navigator.storage.estimate(), null)
  if (!est?.quota) return undefined
  const persisted = await safeAsync(() => navigator.storage.persisted(), undefined)
  const mb = (n: number | undefined) => Math.round((n ?? 0) / 1024 / 1024)
  return { usedMb: mb(est.usage), quotaMb: mb(est.quota), persisted }
}

const NODE_INFO_TIMEOUT_MS = 5_000

/** Состояние ноды; не ответила за 5 секунд — без него, сведения важнее. */
async function nodeState(now: Date): Promise<Partial<SupportReportData['network']>> {
  const request = getByPRC({
    method: rpcEndpoints.getNodeInfo,
    parameters: [],
    options: { auth: false },
  }) as Promise<GetNodeInfoResponse>
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), NODE_INFO_TIMEOUT_MS)
  })
  const response = await Promise.race([request.catch(() => null), timeout])
  clearTimeout(timer)
  if (!response || response.result !== 'success') return {}
  const block = response.data?.lastblock
  // Время блока одни ноды отдают числом, другие — строкой.
  const blockTime = Number(block?.time)
  return {
    nodeServer: response.node,
    nodeVersion: response.data?.version,
    blockHeight: block?.height,
    blockAgeMin:
      blockTime > 0 ? Math.max(0, Math.round((now.getTime() / 1000 - blockTime) / 60)) : undefined,
  }
}

function proxyHost(): string | undefined {
  const node = currentProxy()
  return node ? `${node.host}:${node.port}` : undefined
}

function chatServer(): string | undefined {
  return safe(() => new URL(matrixService.getBaseUrl(), window.location.href).host, undefined)
}

export async function collectSupportReport(now: Date = new Date()): Promise<SupportReportData> {
  const appPlatform = platform()
  const prefs = useAppPreferencesStore()
  const tor = useTorStore()
  const chat = useMessengerUiStore()
  const connection = safe(
    () => (navigator as Navigator & { connection?: { effectiveType?: string } }).connection,
    undefined
  )
  const memory = safe(
    () => (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    undefined
  )
  const [system, nodeFacts, storageUse] = await Promise.all([
    systemInfo(appPlatform === 'desktop'),
    nodeState(now),
    storage(),
  ])

  return {
    report: SUPPORT_REPORT_KIND,
    generatedAt: now.toISOString(),
    utcOffset: utcOffset(now),
    app: {
      version: CURRENT_APP_VERSION,
      build: import.meta.env.MODE,
      platform: appPlatform,
      installed:
        appPlatform === 'web'
          ? safe(() => window.matchMedia('(display-mode: standalone)').matches, false)
          : undefined,
      uptimeMin: Math.round(safe(() => performance.now(), 0) / 60_000),
    },
    system,
    screen: {
      size: safe(() => `${screen.width}x${screen.height}`, ''),
      window: safe(() => `${window.innerWidth}x${window.innerHeight}`, ''),
      pixelRatio: safe(() => window.devicePixelRatio, 1),
      touch: safe(() => navigator.maxTouchPoints > 0, false),
      cores: safe(() => navigator.hardwareConcurrency, undefined) || undefined,
      memoryGb: memory,
    },
    language: {
      app: String(i18n.global.locale.value),
      system: safe(() => [...navigator.languages], []),
    },
    settings: {
      theme: useTheme().mode.value,
      uiScale: prefs.uiScale,
      animations: prefs.animations,
      chatButton: prefs.chatButton,
      tor: tor.available ? (tor.enabled ? torSummary(tor) : 'off') : 'unavailable',
    },
    network: {
      online: safe(() => navigator.onLine, true),
      connection: connection?.effectiveType,
      // После запроса к ноде: если прокси ещё не была выбрана, её выбрал он.
      node: proxyHost(),
      ...nodeFacts,
      chatServer: chatServer(),
      chatSync: chat.syncState,
      chatSyncError: chat.syncError ? scrubForReport(chat.syncError).slice(0, 200) : undefined,
    },
    storage: storageUse,
    errors: recentErrors(),
  }
}

/** JSON для сообщения: по строке на поле, чтобы читалось в окошке. */
export function reportJson(data: SupportReportData): string {
  return JSON.stringify(data, null, 2)
}
