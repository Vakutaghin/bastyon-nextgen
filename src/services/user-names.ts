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
 *
 * Сбой запроса повторяется сам: подпись не перерисовывается, пока не
 * изменится её профиль, и раньше адрес, не получивший имени с первого раза,
 * так и оставался под постом до перезагрузки. Ленты и «Последние комментарии»
 * догружают имена до показа (`preloadUserNames`), как старый клиент
 * (`shares.users`), — тогда адрес не мелькает вовсе.
 *
 * Имена переживают перезапуск (user-names-saved): при запуске они поднимаются
 * с устройства, и подпись сразу выходит с ником — и без сети. Поднятое
 * считается устаревшим: при первом показе адрес спрашивается у ноды заново, а
 * в текст, который уйдёт в блокчейн (`userNameIfKnown`), идёт только имя,
 * пришедшее в этом запуске.
 */

import { reactive } from 'vue'

import { t } from '@/i18n'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { safeDecode } from '@/helpers/content/safe-decode'

/** Профиль в любом виде, в каком его присылает нода. */
export interface ProfileLike {
  address?: string
  name?: string | null
  i?: string | null
  /** true, «deleted» или «temp» — аккаунт удалён или удаляется. */
  deleted?: boolean | string | null
  /** Бейджи узла: `moderator`, `shark`… — для значка у аватара. */
  badges?: unknown
}

interface KnownUser {
  name?: string
  avatar?: string | null
  deleted?: boolean
  /** Бейджи узла; `undefined` — ещё не знаем. */
  badges?: string[]
}

/** Что о пользователе хранится на устройстве. */
export type SavedUser = KnownUser

const NO_BADGES: readonly string[] = Object.freeze([])

function badgesOf(profile: ProfileLike): string[] | undefined {
  return Array.isArray(profile.badges)
    ? profile.badges.filter((b): b is string => typeof b === 'string')
    : undefined
}

function sameBadges(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}

/** Адресов в одном запросе: ответ лёгкого профиля ~1 КБ на адрес. */
const BATCH_SIZE = 50
/** Подписи одного экрана рендерятся разом — собираем их в один запрос. */
const BATCH_DELAY_MS = 30
/** Паузы перед повторами неудавшегося запроса; дальше ждём следующего показа. */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]
/** Дольше экран имён не ждёт: не успевшие подставятся, когда придут. */
const PRELOAD_TIMEOUT_MS = 3_000

/** Реактивно: подписи перерисовываются, когда профиль догрузился. */
const users = reactive(new Map<string, KnownUser>())
/**
 * Адреса, о которых нода ответила в этом запуске. Остальные записи `users`
 * подняты с устройства: их показываем, но спрашиваем заново.
 */
const fresh = new Set<string>()
/** Кто сохраняет имена на устройстве (user-names-saved). */
let onSeen: ((address: string, user: SavedUser) => void) | null = null
const queued = new Set<string>()
/** Адрес → запрос, в котором он уже едет: `preloadUserNames` ждёт и его. */
const inFlight = new Map<string, Promise<void>>()
/** Адрес → сколько запросов подряд с ним сорвалось. */
const failures = new Map<string, number>()
const retryTimers = new Set<ReturnType<typeof setTimeout>>()
let timer: ReturnType<typeof setTimeout> | null = null

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 8)}…` : address
}

/**
 * Нода ответила об адресе в этом запуске. Сохраняем запись, если она
 * изменилась или встретилась впервые за запуск — по второму сохранённые
 * упорядочены по давности, и вытесняются те, кого давно не видели.
 */
function confirm(address: string, changed: boolean): void {
  if (!changed && fresh.has(address)) return
  fresh.add(address)
  const user = users.get(address)
  if (onSeen && user && (user.name || user.deleted)) onSeen(address, user)
}

/** Запомнить профили, пришедшие с лентой, комментариями и т. п. */
export function rememberUsers(profiles: Iterable<ProfileLike | null | undefined>): void {
  for (const profile of profiles) {
    const address = profile?.address
    if (!address) continue
    const known = users.get(address)
    if (profile.deleted) {
      const changed = !known?.deleted
      if (changed) users.set(address, { deleted: true })
      confirm(address, changed)
      continue
    }
    const badges = badgesOf(profile) ?? known?.badges
    const name = decodeName(profile.name)
    if (!name) {
      // Аккаунт без имени: запоминаем хотя бы бейджи.
      const changed = !!badges && !sameBadges(badges, known?.badges)
      if (changed) users.set(address, { ...known, badges })
      confirm(address, changed)
      continue
    }
    const avatar = resolveImageUrl(profile.i) ?? null
    const changed =
      known?.name !== name || (known.avatar ?? null) !== avatar || !sameBadges(known.badges, badges)
    if (changed) users.set(address, { name, avatar, badges })
    confirm(address, changed)
  }
}

/**
 * Имена, сохранённые на устройстве в прошлые запуски. Пришедшее в этом
 * запуске не перетирается; поднятое спросится у ноды, когда его покажут.
 */
export function restoreUsers(saved: Iterable<readonly [string, SavedUser]>): void {
  for (const [address, user] of saved) {
    if (!address || users.has(address) || !user) continue
    const name = typeof user.name === 'string' ? user.name : ''
    if (user.deleted === true) {
      users.set(address, { deleted: true })
    } else if (name) {
      users.set(address, {
        name,
        avatar: typeof user.avatar === 'string' ? user.avatar : null,
        badges: Array.isArray(user.badges)
          ? user.badges.filter((b): b is string => typeof b === 'string')
          : undefined,
      })
    }
  }
}

/** Подписаться на подтверждённые нодой записи — их сохраняют на устройстве. */
export function onUserSeen(listener: ((address: string, user: SavedUser) => void) | null): void {
  onSeen = listener
}

/** Профили из ответа; `null` — ответ не того вида, это сбой, а не «профилей нет». */
function toProfiles(response: unknown): ProfileLike[] | null {
  if (Array.isArray(response)) return response as ProfileLike[]
  const data = (response as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as ProfileLike[]) : null
}

async function load(batch: string[]): Promise<void> {
  try {
    const profiles = toProfiles(
      await getByPRC({
        method: rpcEndpoints.getUserProfile,
        parameters: [batch, '1'],
        options: { auth: false },
      })
    )
    if (!profiles) throw new Error('unexpected getuserprofile response')
    rememberUsers(profiles)
    const returned = new Set(profiles.map((profile) => profile?.address))
    for (const address of batch) {
      failures.delete(address)
      // Профиля нет вовсе (адрес без аккаунта) или бейджей в нём нет: больше
      // не спрашиваем.
      const user = users.get(address)
      if (!user) users.set(address, { badges: [] })
      else if (!user.badges) users.set(address, { ...user, badges: [] })
      // О ком нода не ответила, того сохранённое не продлеваем.
      if (returned.has(address)) confirm(address, !user?.badges)
      else fresh.add(address)
    }
  } catch (error) {
    // Ничего не запоминаем: имя этих адресов спросим ещё раз.
    console.warn('[user-names] getuserprofile failed:', error)
    retryLater(batch)
  }
}

/** Запрос одной пачки; никогда не отклоняется — сбой уходит в повтор. */
function fetchBatch(batch: string[]): Promise<void> {
  const done: Promise<void> = load(batch).finally(() => {
    for (const address of batch) if (inFlight.get(address) === done) inFlight.delete(address)
  })
  for (const address of batch) inFlight.set(address, done)
  return done
}

function retryLater(batch: string[]): void {
  let attempt = 0
  for (const address of batch) {
    const count = (failures.get(address) ?? 0) + 1
    failures.set(address, count)
    attempt = Math.max(attempt, count)
  }
  const delay = RETRY_DELAYS_MS[attempt - 1]
  if (delay === undefined) {
    // Попытки кончились (нода лежит давно): следующий показ подписи начнёт заново.
    for (const address of batch) failures.delete(address)
    return
  }
  const retry = setTimeout(() => {
    retryTimers.delete(retry)
    for (const address of batch) request(address)
  }, delay)
  retryTimers.add(retry)
}

function flush(): void {
  const batch = [...queued].slice(0, BATCH_SIZE)
  for (const address of batch) queued.delete(address)
  if (queued.size) schedule()
  if (batch.length) void fetchBatch(batch)
}

function schedule(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flush()
  }, BATCH_DELAY_MS)
}

/**
 * Спросить адрес у ноды. Известный в этом запуске не спрашивается; поднятый
 * с устройства — спрашивается.
 * @param force - спросить и знакомый адрес: его имя известно, а бейджи — нет.
 */
function request(address: string, force = false): void {
  if ((!force && fresh.has(address)) || queued.has(address) || inFlight.has(address)) return
  queued.add(address)
  schedule()
}

/**
 * Догрузить имена до показа экрана (страница ленты, «Последние комментарии»),
 * чтобы подпись сразу вышла с ником. Ждёт не дольше `timeoutMs`: медленная
 * нода не должна держать ленту, а не успевшие имена подставятся, когда придут.
 */
export async function preloadUserNames(
  addresses: Iterable<string | null | undefined>,
  timeoutMs = PRELOAD_TIMEOUT_MS
): Promise<void> {
  const waits = new Set<Promise<void>>()
  const missing: string[] = []
  /** Подняты с устройства: экран их не ждёт, но спрашиваем тем же запросом. */
  const stale: string[] = []
  for (const address of new Set(addresses)) {
    if (!address || fresh.has(address)) continue
    const pending = inFlight.get(address)
    if (pending) {
      if (!users.has(address)) waits.add(pending)
    } else if (users.has(address)) stale.push(address)
    else missing.push(address)
  }
  const list = [...missing, ...stale]
  for (const address of list) queued.delete(address)
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const done = fetchBatch(list.slice(i, i + BATCH_SIZE))
    if (i < missing.length) waits.add(done)
  }
  if (!waits.size) return
  let timeout: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    Promise.all(waits),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs)
    }),
  ])
  clearTimeout(timeout)
}

/** Имя, пришедшее с данными: адрес на месте имени за имя не считается. */
/**
 * Имя из профиля. Нода отдаёт его как записано в транзакции, часть имён —
 * URL-кодированными («Just%20Saying»): старый клиент их раскодировал.
 */
function decodeName(raw: unknown): string {
  return typeof raw === 'string' ? safeDecode(raw).trim() : ''
}

function knownName(address: string, known: string | ProfileLike | null | undefined): string {
  const name = decodeName(typeof known === 'string' ? known : known?.name)
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
  // Поднятое с устройства показываем сразу, а у ноды спрашиваем заново.
  request(address)
  const user = users.get(address)
  if (user?.name) return user.name
  if (user?.deleted) return t('common.deletedAccount')
  return shortAddress(address)
}

/**
 * Только настоящее имя, без подстановок: для текста, который уйдёт в
 * блокчейн (обращение «@имя,» в ответе). Пока имени нет — пустая строка.
 * Имя, поднятое с устройства, сюда не идёт: человек мог его сменить.
 */
export function userNameIfKnown(
  address: string | null | undefined,
  known?: string | ProfileLike | null
): string {
  if (!address) return ''
  const name = knownName(address, known)
  if (name) return name
  request(address)
  return (fresh.has(address) && users.get(address)?.name) || ''
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

/**
 * Бейджи узла (`moderator`, `shark`…) — для значка у аватара. Реактивно:
 * незнакомый адрес, как и в userName, догружается лёгким профилем.
 */
export function userBadges(address: string | null | undefined): readonly string[] {
  if (!address) return NO_BADGES
  const user = users.get(address)
  request(address, !user?.badges && !user?.deleted)
  return user?.badges ?? NO_BADGES
}

/**
 * Имя, если оно уже известно, — без запроса профиля. Для фильтра по длинному
 * списку: каждый неизвестный адрес иначе ушёл бы на ноду отдельно. Реактивно.
 */
export function peekUserName(address: string): string {
  return users.get(address)?.name ?? ''
}

/**
 * Все, чьи имена уже известны (лента, комментарии, профили): мгновенные
 * подсказки @-упоминаний. Реактивно — computed пересчитается, когда придут
 * новые имена.
 */
export function knownUsers(): Array<{ address: string; name: string; avatar: string | null }> {
  const out: Array<{ address: string; name: string; avatar: string | null }> = []
  for (const [address, user] of users) {
    if (user.name && !user.deleted)
      out.push({ address, name: user.name, avatar: user.avatar ?? null })
  }
  return out
}

/** Только для тестов. */
export function __resetUserNamesForTests(): void {
  users.clear()
  fresh.clear()
  onSeen = null
  queued.clear()
  inFlight.clear()
  failures.clear()
  for (const retry of retryTimers) clearTimeout(retry)
  retryTimers.clear()
  if (timer) clearTimeout(timer)
  timer = null
}
