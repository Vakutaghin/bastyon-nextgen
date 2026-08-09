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
