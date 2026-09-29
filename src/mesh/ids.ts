/**
 * Идентификаторы mesh-диалогов в общем списке мессенджера.
 *
 * `mesh:` отличает их от комнат Matrix (`!…`). Внутри — сеть, свой узел и
 * собеседник: у каждого радио своя переписка (у двух радио — два разных узла).
 *
 * - MeshCore: узел — первые 6 байт ключа (так радио адресует сообщения);
 * - Meshtastic: узел — его номер (`!a1b2c3d4` без `!`);
 * - LXMF (Reticulum): адрес целиком, 16 байт — по нему же и отправка.
 *
 * Канал — хэш его ключа (номер слота на радио может смениться).
 */

export type MeshNetwork = 'meshcore' | 'meshtastic' | 'lxmf'

export const MESH_DIALOG_PREFIX = 'mesh:'

const NETWORK_CODE: Record<MeshNetwork, string> = { meshcore: 'mc', meshtastic: 'mt', lxmf: 'lx' }
const CODE_NETWORK: Record<string, MeshNetwork> = { mc: 'meshcore', mt: 'meshtastic', lx: 'lxmf' }

export function isMeshDialogId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith(MESH_DIALOG_PREFIX)
}

const short = (key: string): string => key.slice(0, 12).toLowerCase()

/** Ключ в id: у LXMF — адрес целиком, у радио-сетей — первые 6 байт. */
const keyIn = (network: MeshNetwork, key: string): string =>
  network === 'lxmf' ? key.slice(0, 32).toLowerCase() : short(key)

/** Номер узла Meshtastic как ключ в id: 8 hex-цифр. */
export function nodeKey(num: number): string {
  return (num >>> 0).toString(16).padStart(8, '0')
}

/** Номер узла Meshtastic из ключа в id. */
export function nodeNumOf(key: string): number | null {
  return /^[0-9a-f]{8}$/.test(key) ? parseInt(key, 16) >>> 0 : null
}

export function directDialogId(network: MeshNetwork, selfKey: string, peerKey: string): string {
  return `${MESH_DIALOG_PREFIX}${NETWORK_CODE[network]}:${keyIn(network, selfKey)}:u:${keyIn(network, peerKey)}`
}

export function channelDialogId(network: MeshNetwork, selfKey: string, channelId: string): string {
  return `${MESH_DIALOG_PREFIX}${NETWORK_CODE[network]}:${short(selfKey)}:g:${channelId}`
}

/** Комната MeshCore (room server): как ЛС с ней, но пишут в неё разные люди. */
export function roomDialogId(network: MeshNetwork, selfKey: string, roomKey: string): string {
  return `${MESH_DIALOG_PREFIX}${NETWORK_CODE[network]}:${short(selfKey)}:r:${short(roomKey)}`
}

export type MeshDialogKind = 'direct' | 'channel' | 'room'

export interface ParsedMeshDialogId {
  network: MeshNetwork
  selfKey: string
  kind: MeshDialogKind
  /** Префикс ключа собеседника или комнаты, id канала. */
  key: string
}

const KIND_OF: Record<string, MeshDialogKind> = { u: 'direct', g: 'channel', r: 'room' }

export function parseMeshDialogId(id: string): ParsedMeshDialogId | null {
  if (!isMeshDialogId(id)) return null
  const [, code, selfKey, kind, key] = id.split(':')
  const network = code ? CODE_NETWORK[code] : undefined
  const dialogKind = kind ? KIND_OF[kind] : undefined
  if (!network || !selfKey || !key || !dialogKind) return null
  return { network, selfKey, kind: dialogKind, key }
}

/** Отправитель в канале известен только по имени, которое написало его радио. */
export function meshSenderId(
  network: MeshNetwork,
  sender: { key?: string | null; name?: string | null }
): string {
  const code = NETWORK_CODE[network]
  if (sender.key) return `${MESH_DIALOG_PREFIX}${code}:u:${keyIn(network, sender.key)}`
  return `${MESH_DIALOG_PREFIX}${code}:n:${sender.name ?? '?'}`
}
