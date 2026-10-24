/**
 * Запросы к серверу чатов в приложении Android — нативным HTTP Capacitor,
 * мимо WebView. В WebView они подчиняются CORS: ответ без заголовков CORS
 * (например, 502/504, которые nginx сервера чатов отдаёт сам) fetch выдаёт
 * как «Failed to fetch», и мессенджер писал «нет связи с сервером чатов»,
 * хотя на компьютере (plugin-http, без CORS) всё работало. Нативный запрос
 * видит настоящий код ответа, а при сбое сети — причину
 * («UnknownHostException: Unable to resolve host …»).
 *
 * Только JSON-API (`/_matrix/client/…`) со строковым телом: медиа и файлы
 * (двоичные тела и ответы) остаются на fetch WebView.
 */

import { Capacitor, CapacitorHttp, type HttpResponse } from '@capacitor/core'
import { headersToRecord, inputToUrl, raceWithAbort } from './request-tor'

const CONNECT_TIMEOUT_MS = 30_000
// Длинный опрос /sync держится 30 с плюс запас; свой таймаут SDK прерывает
// сигналом, а этот — страховка от зависшего соединения.
const READ_TIMEOUT_MS = 120_000
// Коды, у которых по спецификации fetch не бывает тела.
const NULL_BODY_STATUS = new Set([101, 204, 205, 304])

export function isNativeMatrixRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('CapacitorHttp')) return false
  // Тело Request и двоичные тела нативный мост не передаст.
  if (input instanceof Request) return false
  const body = init?.body
  if (body != null && typeof body !== 'string') return false
  // Без Content-Type CapacitorHttp тело молча не отправляет.
  if (body && !Object.keys(headersToRecord(input, init)).some((k) => /^content-type$/i.test(k))) {
    return false
  }
  let path: string
  try {
    path = new URL(inputToUrl(input)).pathname
  } catch {
    return false
  }
  return path.startsWith('/_matrix/client/') && !path.startsWith('/_matrix/client/v1/media/')
}

export async function nativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const request = CapacitorHttp.request({
    url: inputToUrl(input),
    method: (init?.method ?? 'GET').toUpperCase(),
    headers: headersToRecord(input, init),
    data: init?.body ?? undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
    readTimeout: READ_TIMEOUT_MS,
    responseType: 'text',
  })
  let res: HttpResponse
  try {
    res = await raceWithAbort(request, init?.signal)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    // Как у fetch, сбой сети — TypeError. SDK заворачивает его в
    // ConnectionError с этим текстом, баннер показывает его подписью.
    const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown }
    const text = [code, message].filter((x) => typeof x === 'string' && x).join(': ')
    throw new TypeError(text || 'native request failed', { cause: e })
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    try {
      headers.append(k, String(v))
    } catch {
      // непригодный для Headers заголовок
    }
  }
  // JSON CapacitorHttp разбирает сам, а SDK ждёт текст — собираем обратно.
  const data: unknown = res.data
  const text = data == null ? '' : typeof data === 'string' ? data : JSON.stringify(data)
  return new Response(NULL_BODY_STATUS.has(res.status) ? null : text, {
    status: res.status,
    headers,
  })
}
