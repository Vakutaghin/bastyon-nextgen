/**
 * Запросы приложения к прокси — для живой схемы сети в «Блокчейн-обозревателе»:
 * каждый ответ прокси подписывает нодой, которая его готовила (поле `node`),
 * и схема показывает путь «вы → прокси → нода». Пока схему никто не смотрит,
 * подписчиков нет и сообщать нечего.
 */

export interface RpcTrafficEvent {
  /** Хост прокси: `1.pocketnet.app`. */
  proxy: string
  /** Нода, которая ответила, `ip:порт`; null — прокси не сказал или запрос упал. */
  node: string | null
  method: string
  /** Ноду назвали сами (`options.node`, обход сети), а не прокси выбрал. */
  pinned: boolean
  ok: boolean
  ms: number
}

type Listener = (event: RpcTrafficEvent) => void

const listeners = new Set<Listener>()

export function onRpcTraffic(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hasRpcTrafficListeners(): boolean {
  return listeners.size > 0
}

export function reportRpcTraffic(event: RpcTrafficEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // схема не должна ронять запрос
    }
  }
}

/** Нода из ответа прокси: `{ node: '1.2.3.4:38081' }`. */
export function respondingNode(response: unknown): string | null {
  const node = (response as { node?: unknown } | null)?.node
  return typeof node === 'string' && node ? node : null
}
