/**
 * Идентификаторы mesh-диалогов в общем списке мессенджера.
 *
 * `mesh:` отличает их от комнат Matrix (`!…`). Внутри — сеть, свой узел и
 * собеседник: у каждого радио своя переписка (у двух радио — два разных узла).
 * Собеседник в ЛС — первые 6 байт ключа: так радио адресует сообщения, и так
 * они приходят; канал — хэш его ключа (номер слота на радио может смениться).
 */

export type MeshNetwork = 'meshcore'

export const MESH_DIALOG_PREFIX = 'mesh:'

const NETWORK_CODE: Record<MeshNetwork, string> = { meshcore: 'mc' }
const CODE_NETWORK: Record<string, MeshNetwork> = { mc: 'meshcore' }

export function isMeshDialogId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith(MESH_DIALOG_PREFIX)
}

const short = (key: string): string => key.slice(0, 12).toLowerCase()

export function directDialogId(network: MeshNetwork, selfKey: string, peerKey: string): string {
  return `${MESH_DIALOG_PREFIX}${NETWORK_CODE[network]}:${short(selfKey)}:u:${short(peerKey)}`
}

export function channelDialogId(network: MeshNetwork, selfKey: string, channelId: string): string {
  return `${MESH_DIALOG_PREFIX}${NETWORK_CODE[network]}:${short(selfKey)}:g:${channelId}`
}

export interface ParsedMeshDialogId {
  network: MeshNetwork
  selfKey: string
  kind: 'direct' | 'channel'
  /** Префикс ключа собеседника или id канала. */
  key: string
}

export function parseMeshDialogId(id: string): ParsedMeshDialogId | null {
  if (!isMeshDialogId(id)) return null
  const [, code, selfKey, kind, key] = id.split(':')
  const network = code ? CODE_NETWORK[code] : undefined
  if (!network || !selfKey || !key || (kind !== 'u' && kind !== 'g')) return null
  return { network, selfKey, kind: kind === 'u' ? 'direct' : 'channel', key }
}

/** Отправитель в канале известен только по имени, которое написало его радио. */
export function meshSenderId(
  network: MeshNetwork,
  sender: { key?: string | null; name?: string | null }
): string {
  const code = NETWORK_CODE[network]
  if (sender.key) return `${MESH_DIALOG_PREFIX}${code}:u:${short(sender.key)}`
  return `${MESH_DIALOG_PREFIX}${code}:n:${sender.name ?? '?'}`
}
