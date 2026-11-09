/**
 * Нет сети — запрос не уходит.
 *
 * Когда устройство ни к чему не подключено (`navigator.onLine === false`),
 * запрос к ноде, прокси или серверу сразу завершается OfflineError. Раньше он
 * перебирал все прокси, пинговал их заново и повторялся: за минуту холодного
 * запуска без сети — сотни обращений, а пользователь видел техническую строку
 * «All RPC servers failed». Прокси при этом не помечаются мёртвыми, так что
 * после возврата сети запросы идут на ту же ноду без нового поиска.
 *
 * `onLine === true` ничего не обещает (подключено — не значит, что есть
 * интернет), а `false` надёжно: сети точно нет. Своя нода на этом же
 * компьютере (127.0.0.1, localhost) доступна и без сети — её не трогаем.
 */

export class OfflineError extends Error {
  /** Признак без instanceof: ошибка проходит через обёртки и копирование. */
  readonly offline = true

  constructor(what = 'request') {
    super(`No network connection: ${what}`)
    this.name = 'OfflineError'
  }
}

/** Устройство точно без сети. */
export function isOfflineNow(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function isOfflineError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { offline?: unknown }).offline === true
}

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i

/** Адрес на этом же компьютере — до него сеть не нужна. */
export function isLoopbackHost(host: string | undefined | null): boolean {
  return !!host && LOOPBACK.test(host.trim())
}

/** Бросить OfflineError, если сети нет, а адрес не на этом компьютере. */
export function assertOnline(what: string, host?: string | null): void {
  if (isOfflineNow() && !isLoopbackHost(host)) throw new OfflineError(what)
}
