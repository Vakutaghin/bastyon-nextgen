// Сборка URL контента по IpfsTarget: на шлюзе своей ноды (окно просмотра на
// компьютере) или на inbrowser.link (браузер, когда своей ноды нет).
//
// Публичные шлюзы ipfs.io и dweb.link с сентября 2026 приложениям содержимое
// не отдают: Shipyard, которая их держала, свернула работу по IPFS, а шлюзы
// отвечают проверкой Cloudflare или «только service worker». Людей в браузере
// они переводят на inbrowser.link — там содержимое из сети качает и проверяет
// сам браузер (service worker), а не сервер.
import type { IpfsTarget } from './ipfs-link'

/**
 * Публичный шлюз. Приложениям он больше не отвечает, поэтому здесь это только
 * метка «своей ноды нет» из `resolveGateway`.
 */
export const IPFS_GATEWAY = 'https://dweb.link'

/** Шлюз-service worker для браузера: путь `/ipfs/<cid>` уводит на поддомен CID. */
export const IPFS_WEB_VIEWER = 'https://inbrowser.link'

/** Открыть в браузере, без своей ноды. */
export function buildIpfsWebUrl(target: IpfsTarget): string {
  return buildIpfsViewerUrl(target, IPFS_WEB_VIEWER)
}

export function buildIpfsViewerUrl(target: IpfsTarget, gateway: string = IPFS_GATEWAY): string {
  const base = gateway.replace(/\/+$/, '')
  const suffix = target.path ? `/${target.path}` : ''
  return `${base}/${target.namespace}/${target.root}${suffix}`
}

/**
 * Ссылка на публикацию из «Моих файлов». Публичный файл лежит в каталоге-
 * обёртке — `ipfs://<каталог>/<имя>`: имя и тип видны до скачивания. У
 * приватного ключ и имя во фрагменте (см. buildIpfsSecretLink). Размер — тоже
 * во фрагменте: карточка в чате показывает его до скачивания.
 */
export function buildShareLink(share: {
  cid: string
  name: string
  size?: number
  key?: string
}): string {
  if (share.key) return buildIpfsSecretLink(share.cid, share.key, share.name, share.size)
  const size = share.size === undefined ? '' : `#size=${share.size}`
  return `ipfs://${share.cid.trim()}/${encodeURIComponent(share.name)}${size}`
}

/**
 * Приватная шаринг-ссылка: ключ и имя файла во ФРАГМЕНТЕ (`#…`) — фрагмент не
 * уходит в HTTP-запросах на gateway, только клиент видит ключ. encodeURIComponent,
 * т.к. base64 содержит `+/=`.
 */
export function buildIpfsSecretLink(
  cid: string,
  keyB64: string,
  filename: string,
  size?: number
): string {
  const k = encodeURIComponent(keyB64)
  const n = encodeURIComponent(filename)
  const sz = size === undefined ? '' : `&size=${size}`
  return `ipfs://${cid.trim()}#key=${k}&name=${n}${sz}`
}
