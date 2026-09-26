// ЕДИНСТВЕННАЯ движок-зависимая точка IPFS-просмотрщика: сборка URL контента по
// IpfsTarget. Сейчас — HTTP-gateway. Когда/если в Bastyon появится встроенная
// нода Kubo (как в проекте ipfs-site/app), достаточно заменить эту функцию на
// сборку URL локального gateway (http://127.0.0.1:<port>/ipfs/<cid>/) — перехват
// кликов и создание окна (use-ipfs-links) не меняются.
//
// ВНИМАНИЕ: dweb.link — ПУБЛИЧНЫЙ шлюз (быстрый дефолт, чтобы фича работала из
// коробки). Тезис ipfs-site — «без публичных шлюзов»; при переходе на свою ноду
// поменяй IPFS_GATEWAY на свой Kubo-gateway или встроенную ноду.
import type { IpfsTarget } from './ipfs-link'

export const IPFS_GATEWAY = 'https://dweb.link'

export function buildIpfsViewerUrl(target: IpfsTarget, gateway: string = IPFS_GATEWAY): string {
  const base = gateway.replace(/\/+$/, '')
  const suffix = target.path ? `/${target.path}` : ''
  return `${base}/${target.namespace}/${target.root}${suffix}`
}

/**
 * Ссылка на публикацию из «Моих файлов». Публичный файл лежит в каталоге-
 * обёртке — `ipfs://<каталог>/<имя>`: имя и тип видны до скачивания. У
 * приватного ключ и имя во фрагменте (см. buildIpfsSecretLink).
 */
export function buildShareLink(share: { cid: string; name: string; key?: string }): string {
  if (share.key) return buildIpfsSecretLink(share.cid, share.key, share.name)
  return `ipfs://${share.cid.trim()}/${encodeURIComponent(share.name)}`
}

/**
 * Приватная шаринг-ссылка: ключ и имя файла во ФРАГМENTE (`#…`) — фрагмент не
 * уходит в HTTP-запросах на gateway, только клиент видит ключ. encodeURIComponent,
 * т.к. base64 содержит `+/=`.
 */
export function buildIpfsSecretLink(cid: string, keyB64: string, filename: string): string {
  const k = encodeURIComponent(keyB64)
  const n = encodeURIComponent(filename)
  return `ipfs://${cid.trim()}#key=${k}&name=${n}`
}
