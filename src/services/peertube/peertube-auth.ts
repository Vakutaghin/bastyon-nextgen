/**
 * Фаза B — авторизация загрузки видео на PeerTube-инстанс.
 *
 * Порт из pocketnet.gui/js/peertube.js:1254-1354 (user.auth/getToken). Всё идёт
 * НАПРЯМУЮ браузер → инстанс (не через ноду):
 *   1) GET  api/v1/oauth-clients/local        → { client_id, client_secret }
 *   2) POST api/v1/users/blockChainAuth        (подпись 'peertube') → { externalAuthToken, username, isNewUser }
 *   3) POST api/v1/users/token                 (grant_type=password) → { access_token, refresh_token, ... }
 * Токен кэшируется пер-user-пер-host, expires_in хранится АБСОЛЮТНЫМ epoch-дедлайном.
 *
 * Подпись — та же схема, что RPC-auth (generateApiSignature с data='peertube'):
 * nonce `date=…,exp=360,s=hexEncode('peertube')`, sha256, secp256k1, v:1.
 */

import { generateApiSignature } from '@/blockchain/core/signatures/api-signature'
import type { ApiSignature } from '@/blockchain/types/signatures'
import type { KeyPair } from '@/blockchain/types/keys'
import type { Address } from '@/blockchain/types/addresses'
import { peertubeInstanceFetch, serializeForm, type InstanceFetch } from './peertube-instance'

export type { InstanceFetch }

/** Токен PeerTube в том виде, как он лежит в localStorage. */
export interface PeertubeToken {
  access_token: string
  refresh_token: string
  /** АБСОЛЮТНЫЙ epoch-дедлайн (сек): now + ttl - 60. Сверять с nowSec(), не как TTL. */
  expires_in: number
  refresh_token_expires_in: number
  isNewUser: boolean
}

/** Канал/квота пользователя на инстансе (нужен channelId для upload-payload). */
export interface PeertubeChannel {
  channelId: number
  videoQuotaDaily: number
  videoQuota: number
  username: string
}

const nowSec = (): number => Math.floor(Date.now() / 1000)

/** Строит подпись 'peertube' — тонкая обёртка над общей RPC-подписью. */
export function buildPeertubeSignature(keyPair: KeyPair, address: Address): ApiSignature {
  return generateApiSignature(keyPair, address, { data: 'peertube' })
}

// ── кэш токенов (пер-user-пер-host) ──────────────────────────────────────────

export function peertubeTokenKey(address: string, host: string): string {
  return `token_${address}_${host}`
}

export function loadPeertubeToken(address: string, host: string): PeertubeToken | null {
  try {
    const raw = localStorage.getItem(peertubeTokenKey(address, host))
    if (!raw) return null
    const t = JSON.parse(raw) as Partial<PeertubeToken>
    if (!t?.access_token || !t?.refresh_token) return null
    return t as PeertubeToken
  } catch {
    return null
  }
}

export function savePeertubeToken(address: string, host: string, token: PeertubeToken): void {
  try {
    localStorage.setItem(peertubeTokenKey(address, host), JSON.stringify(token))
  } catch {
    // quota/недоступность storage — токен просто не закэшируется, не критично.
  }
}

export function isAccessTokenValid(token: PeertubeToken | null, now: number = nowSec()): boolean {
  return !!token && typeof token.expires_in === 'number' && now < token.expires_in
}

export function isRefreshTokenValid(token: PeertubeToken | null, now: number = nowSec()): boolean {
  return (
    !!token &&
    typeof token.refresh_token_expires_in === 'number' &&
    now < token.refresh_token_expires_in
  )
}

// ── шаги handshake ───────────────────────────────────────────────────────────

interface RawTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}

async function getOauthClient(
  fetchInstance: InstanceFetch
): Promise<{ client_id: string; client_secret: string }> {
  const res = await fetchInstance('api/v1/oauth-clients/local', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`peertube_oauth_clients_${res.status}`)
  const j = (await res.json()) as { client_id?: string; client_secret?: string } | null
  if (!j?.client_id || !j?.client_secret) throw new Error('peertube_oauth_clients_invalid')
  return { client_id: j.client_id, client_secret: j.client_secret }
}

async function blockChainAuth(
  fetchInstance: InstanceFetch,
  signature: ApiSignature
): Promise<{ externalAuthToken: string; username: string; isNewUser: boolean }> {
  const res = await fetchInstance('api/v1/users/blockChainAuth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: serializeForm(signature as unknown as Record<string, unknown>),
  })
  if (!res.ok) throw new Error(`peertube_blockchain_auth_${res.status}`)
  const j = (await res.json()) as {
    externalAuthToken?: string
    username?: string
    isNewUser?: boolean
  } | null
  if (!j?.externalAuthToken || !j?.username) throw new Error('peertube_blockchain_auth_invalid')
  return { externalAuthToken: j.externalAuthToken, username: j.username, isNewUser: !!j.isNewUser }
}

async function requestToken(
  fetchInstance: InstanceFetch,
  body: Record<string, unknown>
): Promise<RawTokenResponse> {
  const res = await fetchInstance('api/v1/users/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: serializeForm(body),
  })
  if (!res.ok) throw new Error(`peertube_token_${res.status}`)
  const j = (await res.json()) as RawTokenResponse | null
  if (!j?.access_token || !j?.refresh_token) throw new Error('peertube_token_invalid')
  return j
}

/** Нормализует ответ token-эндпоинта в хранимый вид (абсолютные дедлайны, -60с запас). */
function toStoredToken(raw: RawTokenResponse, isNewUser: boolean, now: number): PeertubeToken {
  return {
    access_token: raw.access_token as string,
    refresh_token: raw.refresh_token as string,
    expires_in: now + (raw.expires_in ?? 0) - 60,
    refresh_token_expires_in: now + (raw.refresh_token_expires_in ?? 0) - 60,
    isNewUser,
  }
}

/** Полная авторизация (3 шага). Возвращает свежий токен, НЕ кэширует. */
export async function authenticatePeertube(
  signature: ApiSignature,
  fetchInstance: InstanceFetch,
  now: () => number = nowSec
): Promise<PeertubeToken> {
  const { client_id, client_secret } = await getOauthClient(fetchInstance)
  const { externalAuthToken, username, isNewUser } = await blockChainAuth(fetchInstance, signature)
  const raw = await requestToken(fetchInstance, {
    client_id,
    client_secret,
    externalAuthToken,
    username,
    grant_type: 'password',
    response_type: 'code',
  })
  return toStoredToken(raw, isNewUser, now())
}

/** Обновление по refresh_token (нужен свежий client_id/secret — их в кэше нет). */
async function refreshPeertubeToken(
  cached: PeertubeToken,
  fetchInstance: InstanceFetch,
  now: () => number
): Promise<PeertubeToken> {
  const { client_id, client_secret } = await getOauthClient(fetchInstance)
  const raw = await requestToken(fetchInstance, {
    client_id,
    client_secret,
    refresh_token: cached.refresh_token,
    grant_type: 'refresh_token',
    response_type: 'code',
  })
  return toStoredToken(raw, cached.isNewUser, now())
}

export interface EnsureTokenParams {
  host: string
  address: string
  /** Подпись 'peertube' (buildPeertubeSignature) — для полной авторизации. */
  signature: ApiSignature
  /** DI для тестов; по умолчанию — host-scoped peertubeInstanceFetch. */
  fetchInstance?: InstanceFetch
  /** DI времени (сек) для тестов. */
  now?: () => number
}

/**
 * Главная точка: отдаёт валидный access-токен для host.
 * Кэш → (если истёк, но refresh жив) refresh → иначе полная авторизация. Кэширует результат.
 */
export async function ensurePeertubeToken(params: EnsureTokenParams): Promise<PeertubeToken> {
  const { host, address, signature } = params
  const now = params.now ?? nowSec
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const cached = loadPeertubeToken(address, host)
  if (isAccessTokenValid(cached, now())) return cached as PeertubeToken

  if (isRefreshTokenValid(cached, now())) {
    try {
      const refreshed = await refreshPeertubeToken(cached as PeertubeToken, fetchInstance, now)
      savePeertubeToken(address, host, refreshed)
      return refreshed
    } catch {
      // refresh не удался — падаем на полную авторизацию.
    }
  }

  const fresh = await authenticatePeertube(signature, fetchInstance, now)
  savePeertubeToken(address, host, fresh)
  return fresh
}

export interface GetChannelParams {
  host: string
  accessToken: string
  fetchInstance?: InstanceFetch
}

/**
 * channelId + квоты через GET api/v1/users/me (Bearer). Реджект, если нет канала
 * или дневной квоты — mirror оригинала (без канала аплоуд молча падает).
 */
export async function getPeertubeChannel(params: GetChannelParams): Promise<PeertubeChannel> {
  const { host, accessToken } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const res = await fetchInstance('api/v1/users/me', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`peertube_me_${res.status}`)
  const j = (await res.json()) as {
    videoChannels?: Array<{ id?: number }>
    videoQuotaDaily?: number
    videoQuota?: number
    username?: string
  } | null

  const channelId = j?.videoChannels?.[0]?.id
  if (channelId == null || j?.videoQuotaDaily == null) throw new Error('peertube_no_channel')
  return {
    channelId,
    videoQuotaDaily: j.videoQuotaDaily,
    videoQuota: j.videoQuota ?? -1,
    username: j.username ?? '',
  }
}
