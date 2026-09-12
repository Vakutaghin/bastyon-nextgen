// Распознавание IPFS-ссылок в кликах по контенту. Чистая функция —
// перехват/окно строятся поверх неё (см. use-ipfs-links). Поддерживаем:
//   ipfs://<cid>[/path]           ipns://<name>[/path]          (scheme-форма)
//   .../ipfs/<cid>[/path]         .../ipns/<name>[/path]        (path/gateway)
//   <cid>.ipfs.<gw>[/path]        <name>.ipns.<gw>[/path]       (subdomain-gateway)
// Subdomain-форма (dweb.link, *.dweb.link) — канонический вид публичных шлюзов
// с origin-изоляцией; без неё ссылки вида bafy….ipfs.dweb.link не открывались.
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

// Метка subdomain-шлюза обязана быть CID-подобной: multibase-префикс `b` (base32)
// или `k` (base36), только строчные (регистрозависимый base58 в subdomain
// невозможен). Иначе любой хост с меткой «ipfs» посередине (docs.ipfs.tech,
// gateway.ipfs.io, www.ipfs.io) ошибочно считался бы IPFS-ссылкой и перехватывался.
const CID_LABEL_RE = /^(b[a-z2-7]{20,}|k[a-z0-9]{20,})$/

/**
 * Инлайн-DNSLink в IPNS-subdomain: точки домена кодируются как `-`, а дефисы —
 * как `--` (`en-wikipedia--on--ipfs-org` → `en.wikipedia-on-ipfs.org`).
 * Сначала прячем `--`, потом `-`→`.`, потом возвращаем `-`.
 */
function uninlineDnsLink(label: string): string {
  const DOUBLE = ''
  return label.split('--').join(DOUBLE).split('-').join('.').split(DOUBLE).join('-')
}

/** Корень из subdomain-метки либо null, если метка не похожа на CID/DNSLink. */
function subdomainRoot(ns: string, label: string): string | null {
  if (CID_LABEL_RE.test(label)) return label
  // IPNS: инлайн-DNSLink обязан содержать хотя бы один «-» (инлайн точки домена).
  if (ns === 'ipns' && label.includes('-')) return uninlineDnsLink(label)
  return null
}

/** Сегмент пути, который WHATWG-парсер схлопнул бы (`..` вывел бы URL за `/ipfs/<cid>`). */
function isDotSegment(seg: string): boolean {
  let d = seg
  try {
    d = decodeURIComponent(seg)
  } catch {
    /* битый — сравниваем как есть */
  }
  return d === '.' || d === '..'
}

function build(ns: string, root: string, rest: string): IpfsTarget | null {
  let r = root
  try {
    r = decodeURIComponent(root)
  } catch {
    /* оставляем как есть */
  }
  // Корень: без точечных сегментов (`ipfs://../api/v0/…` → корень gateway).
  if (!r || !ROOT_RE.test(r) || isDotSegment(r) || r.includes('..')) return null
  // Путь: выкидываем `.`/`..`/пустые сегменты, остальное оставляем как в href.
  const path = (rest || '')
    .replace(/[?#].*$/, '')
    .split('/')
    .filter((seg) => seg !== '' && !isDotSegment(seg))
    .join('/')
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
  if (scheme) return build(scheme[1] ?? '', scheme[2] ?? '', scheme[3] ?? '')

  // Полный URL → берём host и pathname; относительный путь → как есть.
  let pathname = raw
  let hostname = ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      pathname = u.pathname
      hostname = u.hostname
    } catch {
      return null
    }
  }

  // path/gateway-форма — ПЕРВОЙ: явный /ipfs|ipns/ в пути важнее хоста
  // (gateway.ipfs.io/ipfs/<cid> — это path-форма, хотя в хосте есть «ipfs»).
  const pathMatch = /^\/(ipfs|ipns)\/([^/?#]+)([^?#]*)/i.exec(pathname)
  if (pathMatch) return build(pathMatch[1] ?? '', pathMatch[2] ?? '', pathMatch[3] ?? '')

  // subdomain-gateway-форма: <cid>.ipfs.<gw>[/path] / <name>.ipns.<gw>[/path].
  // Берём только ПЕРВУЮ метку хоста и требуем CID-подобия (см. CID_LABEL_RE).
  if (hostname) {
    const sub = /^([^.]+)\.(ipfs|ipns)\./i.exec(hostname)
    if (sub) {
      const ns = (sub[2] ?? '').toLowerCase()
      const root = subdomainRoot(ns, sub[1] ?? '')
      if (root) return build(ns, root, pathname)
    }
  }

  return null
}
