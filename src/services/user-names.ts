/**
 * Имя пользователя по адресу — для подписей: автор комментария, последнего
 * комментария под постом, автор в «Ещё видео автора» и т. п.
 *
 * Нода присылает профиль не везде. У последнего комментария под постом
 * (getrawtransactionwithmessagebyid) есть только адрес, у постов из
 * getprofilefeed профиля автора нет, а у удалённого аккаунта вместо профиля
 * заглушка `{ address, deleted: true }`. Раньше на месте ника оставался адрес.
 *
 * Здесь имена запоминаются из профилей, которые уже пришли с данными, а
 * недостающие догружаются пакетным `getuserprofile [адреса, '1']`, как в
 * старом клиенте: лёгкий профиль весит около 1 КБ, полный — сотни КБ. Пока
 * профиль грузится, вместо имени — короткий адрес; удалённый аккаунт
 * подписывается «Аккаунт удалён», как в старом клиенте.
 */

import { reactive } from 'vue'

import { t } from '@/i18n'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

/** Профиль в любом виде, в каком его присылает нода. */
export interface ProfileLike {
  address?: string
  name?: string | null
  i?: string | null
  /** true, «deleted» или «temp» — аккаунт удалён или удаляется. */
  deleted?: boolean | string | null
}

interface KnownUser {
  name?: string
  avatar?: string | null
  deleted?: boolean
}

/** Адресов в одном запросе: ответ лёгкого профиля ~1 КБ на адрес. */
const BATCH_SIZE = 50
/** Подписи одного экрана рендерятся разом — собираем их в один запрос. */
const BATCH_DELAY_MS = 30

/** Реактивно: подписи перерисовываются, когда профиль догрузился. */
const users = reactive(new Map<string, KnownUser>())
const queued = new Set<string>()
const inFlight = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 8)}…` : address
}

/** Запомнить профили, пришедшие с лентой, комментариями и т. п. */
export function rememberUsers(profiles: Iterable<ProfileLike | null | undefined>): void {
  for (const profile of profiles) {
    const address = profile?.address
    if (!address) continue
    if (profile.deleted) {
      if (!users.get(address)?.deleted) users.set(address, { deleted: true })
      continue
    }
    const name = typeof profile.name === 'string' ? profile.name.trim() : ''
    if (!name) continue
    const avatar = resolveImageUrl(profile.i) ?? null
    const known = users.get(address)
    if (known?.name === name && (known.avatar ?? null) === avatar) continue
    users.set(address, { name, avatar })
  }
}

function toProfiles(response: unknown): ProfileLike[] {
  if (Array.isArray(response)) return response as ProfileLike[]
  const data = (response as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as ProfileLike[]) : []
}

async function flush(): Promise<void> {
  const batch = [...queued].slice(0, BATCH_SIZE)
  for (const address of batch) {
    queued.delete(address)
    inFlight.add(address)
  }
  if (queued.size) schedule()
  try {
    const response = await getByPRC({
      method: rpcEndpoints.getUserProfile,
      parameters: [batch, '1'],
      options: { auth: false },
    })
    rememberUsers(toProfiles(response))
    // Профиля нет вовсе (адрес без аккаунта): больше не спрашиваем.
    for (const address of batch) if (!users.has(address)) users.set(address, {})
  } catch (error) {
    // Сеть: ничего не запоминаем, следующий показ спросит снова.
    console.warn('[user-names] getuserprofile failed:', error)
  } finally {
    for (const address of batch) inFlight.delete(address)
  }
}

function schedule(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, BATCH_DELAY_MS)
}

function request(address: string): void {
  if (users.has(address) || queued.has(address) || inFlight.has(address)) return
  queued.add(address)
  schedule()
}

/** Имя, пришедшее с данными: адрес на месте имени за имя не считается. */
function knownName(address: string, known: string | ProfileLike | null | undefined): string {
  const raw = typeof known === 'string' ? known : known?.name
  const name = typeof raw === 'string' ? raw.trim() : ''
  return name && name !== address ? name : ''
}

function isDeleted(known: string | ProfileLike | null | undefined): boolean {
  return typeof known === 'object' && !!known?.deleted
}

/**
 * Подпись пользователя: имя, «Аккаунт удалён» или короткий адрес, пока
 * профиль грузится. `known` — имя или профиль, пришедшие вместе с данными.
 */
export function userName(
  address: string | null | undefined,
  known?: string | ProfileLike | null
): string {
  if (!address) return knownName('', known)
  const name = knownName(address, known)
  if (name) return name
  if (isDeleted(known)) return t('common.deletedAccount')
  const user = users.get(address)
  if (user?.name) return user.name
  if (user?.deleted) return t('common.deletedAccount')
  request(address)
  return shortAddress(address)
}

/**
 * Только настоящее имя, без подстановок: для текста, который уйдёт в
 * блокчейн (обращение «@имя,» в ответе). Пока имени нет — пустая строка.
 */
export function userNameIfKnown(
  address: string | null | undefined,
  known?: string | ProfileLike | null
): string {
  if (!address) return ''
  const name = knownName(address, known)
  if (name) return name
  const user = users.get(address)
  if (user?.name) return user.name
  if (!user?.deleted) request(address)
  return ''
}

/**
 * Аватар пользователя: пришедший с данными или из профиля, который догрузил
 * userName. Сам не запрашивает: аватара нет у многих, чьё имя уже известно.
 */
export function userAvatar(
  address: string | null | undefined,
  known?: string | null
): string | null {
  if (known) return known
  if (!address) return null
  return users.get(address)?.avatar ?? null
}

/** Только для тестов. */
export function __resetUserNamesForTests(): void {
  users.clear()
  queued.clear()
  inFlight.clear()
  if (timer) clearTimeout(timer)
  timer = null
}
