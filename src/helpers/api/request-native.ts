/**
 * Запросы к серверу чатов в приложении Android — нативным HTTP, мимо WebView
 * (плагин MatrixHttp, android/…/plugins/MatrixHttpPlugin.java). В WebView они
 * подчиняются CORS: ответ без заголовков CORS (например, 502/504, которые
 * nginx сервера чатов отдаёт сам) fetch выдаёт как «Failed to fetch», и
 * мессенджер писал «нет связи с сервером чатов», хотя на компьютере
 * (plugin-http, без CORS) всё работало. Нативный запрос видит настоящий код
 * ответа, а при сбое сети — причину («UnknownHostException: Unable to resolve
 * host …»).
 *
 * Тело ответа плагин пишет в файл, и WebView читает его сам: в памяти Java
 * ответ не держится. С CapacitorHttp, который разбирал JSON в Java, первый
 * /sync большого аккаунта кончался OutOfMemoryError, и запрос висел без
 * ответа и без ошибки.
 *
 * Только JSON-API (`/_matrix/client/…`) со строковым телом: медиа и файлы
 * (двоичные тела и ответы) остаются на fetch WebView.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { headersToRecord, inputToUrl, raceWithAbort } from './request-tor'

interface NativeResponse {
  status: number
  headers: Record<string, string>
  /** Файл с телом ответа; '' — тела нет. */
  path: string
}

interface MatrixHttpPlugin {
  request(options: {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body?: string
    connectTimeout: number
    readTimeout: number
  }): Promise<NativeResponse>
  cancel(options: { id: string }): Promise<void>
  release(options: { path: string }): Promise<void>
}

const MatrixHttp = registerPlugin<MatrixHttpPlugin>('MatrixHttp')

const CONNECT_TIMEOUT_MS = 30_000
// Длинный опрос /sync держится 30 с плюс запас; свой таймаут SDK прерывает
// сигналом, а этот — страховка от зависшего соединения.
const READ_TIMEOUT_MS = 120_000
// HttpURLConnection умеет только эти; PATCH и прочее — через WebView.
const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'HEAD'])
// Коды, у которых по спецификации fetch не бывает тела.
const NULL_BODY_STATUS = new Set([101, 204, 205, 304])

let counter = 0

export function isNativeMatrixRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('MatrixHttp')) return false
  // Тело Request и двоичные тела нативный мост не передаст.
  if (input instanceof Request) return false
  const body = init?.body
  if (body != null && typeof body !== 'string') return false
  if (!METHODS.has((init?.method ?? 'GET').toUpperCase())) return false
  let path: string
  try {
    path = new URL(inputToUrl(input)).pathname
  } catch {
    return false
  }
  return path.startsWith('/_matrix/client/') && !path.startsWith('/_matrix/client/v1/media/')
}

function release(path: string): void {
  if (path) void MatrixHttp.release({ path }).catch(() => {})
}

export async function nativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const id = `m${Date.now().toString(36)}-${++counter}`
  const body = init?.body
  const request = MatrixHttp.request({
    id,
    url: inputToUrl(input),
    method: (init?.method ?? 'GET').toUpperCase(),
    headers: headersToRecord(input, init),
    ...(typeof body === 'string' ? { body } : {}),
    connectTimeout: CONNECT_TIMEOUT_MS,
    readTimeout: READ_TIMEOUT_MS,
  })
  let res: NativeResponse
  try {
    res = await raceWithAbort(request, init?.signal)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // Отменённый запрос обрываем и там; если ответ всё же успел — его файл не нужен.
      void MatrixHttp.cancel({ id }).catch(() => {})
      void request.then(
        (late) => release(late.path),
        () => {}
      )
      throw e
    }
    // Как у fetch, сбой сети — TypeError. SDK заворачивает его в
    // ConnectionError с этим текстом, баннер показывает его подписью.
    const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown }
    const text = [code, message].filter((x) => typeof x === 'string' && x).join(': ')
    throw new TypeError(text || 'native request failed', { cause: e })
  }

  let data: ArrayBuffer | null = null
  try {
    if (res.path && !NULL_BODY_STATUS.has(res.status)) {
      // Файл кэша приложения WebView отдаёт со своего адреса — без CORS.
      data = await (await fetch(Capacitor.convertFileSrc(res.path))).arrayBuffer()
    }
  } catch (e) {
    throw new TypeError('native response unreadable', { cause: e })
  } finally {
    release(res.path)
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    try {
      headers.append(k, String(v))
    } catch {
      // непригодный для Headers заголовок
    }
  }
  return new Response(data, { status: res.status, headers })
}
