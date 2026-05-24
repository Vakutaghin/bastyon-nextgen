import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Один пир, возвращаемый getpeerinfo() ноды.
 *
 * Соответствует Bitcoin Core API формату. Pocketnet возвращает версию строкой
 * /Satoshi:0.22.21/, протокол числом (70016), pingtime в микросекундах.
 */
export interface PeerInfo {
  /** Адрес в формате "ip:port". */
  addr: string
  /** Hex-маска флагов сервисов. */
  services: string
  /** Передаёт ли пир транзакции. */
  relaytxes: boolean
  /** Unix timestamp последней отправки данных пиру. */
  lastsend: number
  /** Unix timestamp последнего получения данных от пира. */
  lastrecv: number
  /** Unix timestamp начала соединения. */
  conntime: number
  /** Расхождение часов с пиром, секунды (может быть отрицательным). */
  timeoffset: number
  /** Время пинга в МИКРОсекундах (1 000 000 = 1 секунда). */
  pingtime: number
  /** Версия протокола (число). */
  protocol: number
  /** Версия клиента строкой, обычно /Satoshi:.../. */
  version: string
  /** Inbound = пир подключился к нам; иначе мы к нему. */
  inbound: boolean
  /** В whitelist (доверенный). */
  whitelisted: boolean
  /** Счётчик нарушений, при достижении порога пир банится. */
  banscore: number
  /** Высота, на которой пир был при первом соединении. */
  startingheight: number
  /** Высота заголовков, синхронизированная с пиром. */
  synced_headers: number
  /** Высота блоков, синхронизированная с пиром. */
  synced_blocks: number
}

export type GetPeerInfoResponse = BaseRpcResponse<PeerInfo[], StandardRpcTime>
