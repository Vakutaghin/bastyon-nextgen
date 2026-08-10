// Распознавание IPFS-ссылок в кликах по контенту. Чистая функция —
// перехват/окно строятся поверх неё (см. use-ipfs-links). Поддерживаем:
//   ipfs://<cid>[/path]      ipns://<name>[/path]        (scheme-форма)
//   .../ipfs/<cid>[/path]    .../ipns/<name>[/path]      (path/gateway-форма)
// Обычные http(s)-ссылки НЕ трогаем — только явные IPFS/IPNS.

export type IpfsNamespace = 'ipfs' | 'ipns'

export interface IpfsTarget {
  namespace: IpfsNamespace
  /** CID (для ipfs) или имя (для ipns). */
  root: string
  /** Путь после корня, без ведущего слэша ('' если нет). */
  path: string
}

// Лениво: CID/IPNS-токен — буквы/цифры и немного пунктуации, без слэшей/пробелов.
const ROOT_RE = /^[A-Za-z0-9._-]+$/

function build(ns: string, root: string, rest: string): IpfsTarget | null {
  let r = root
  try {
    r = decodeURIComponent(root)
  } catch {
    /* оставляем как есть */
  }
  if (!r || !ROOT_RE.test(r)) return null
  const path = (rest || '').replace(/[?#].*$/, '').replace(/^\/+/, '').replace(/\/+$/, '')
  return { namespace: ns.toLowerCase() as IpfsNamespace, root: r, path }
}

/** Секрет приватной ссылки: симметричный ключ (base64) и исходное имя файла. */
export interface IpfsSecret {
  key: string
  name: string
}

/**
 * Извлекает ключ/имя из фрагмента приватной ссылки (`…#key=<b64>&name=<file>`).
 * Фрагмент не уходит на gateway. Парсим вручную (не URLSearchParams): base64
 * содержит `+`, который URLSearchParams превратил бы в пробел.
 */
export function parseIpfsSecret(href: string): IpfsSecret | null {
  if (!href || typeof href !== 'string') return null
  const hashIdx = href.indexOf('#')
  if (hashIdx < 0) return null
  const frag = href.slice(hashIdx + 1)
  if (!frag) return null

  let key = ''
  let name = ''
  for (const pair of frag.split('&')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const k = pair.slice(0, eq)
    const v = pair.slice(eq + 1)
    try {
      if (k === 'key') key = decodeURIComponent(v)
      else if (k === 'name') name = decodeURIComponent(v)
    } catch {
      /* битый компонент — игнорируем */
    }
  }
  return key ? { key, name } : null
}

/**
 * Разбирает href в IpfsTarget или возвращает null, если это не IPFS/IPNS-ссылка.
 */
export function parseIpfsLink(href: string): IpfsTarget | null {
  if (!href || typeof href !== 'string') return null
  const raw = href.trim()

  // scheme-форма: ipfs://<root>[/path]
  const scheme = /^(ipfs|ipns):\/\/([^/?#]+)([^?#]*)/i.exec(raw)
  if (scheme) return build(scheme[1], scheme[2], scheme[3])

  // path/gateway-форма: pathname начинается с /ipfs/<root> или /ipns/<root>.
  let pathname = raw
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname
    } catch {
      return null
    }
  }
  const pathMatch = /^\/(ipfs|ipns)\/([^/?#]+)([^?#]*)/i.exec(pathname)
  if (pathMatch) return build(pathMatch[1], pathMatch[2], pathMatch[3])

  return null
}
