/**
 * Резолвер ника пользователя → blockchain-адрес.
 *
 * Зачем. В оригинале (`satolist.js:11777`) есть `users.nameaddressstorage`
 * — карта `lowercaseName → address`, заполняемая везде, где приходят
 * объекты `userprofile` (search, feed, comments). Когда пользователь
 * вводит ник в строку поиска и жмёт Enter — клиент сразу резолвит его
 * в адрес и навигирует на профиль, минуя промежуточную выдачу.
 *
 * Здесь: in-memory кеш + persistent кеш через settingsAPI, +
 * `resolveRemote` через `searchusers` как fallback.
 *
 * Persist важен: между перезагрузками страница не должна забывать, что
 * пользователь по нику X — это адрес Y, иначе автонавигация по `@name`
 * сразу после ввода будет ломаться при первом запуске.
 */

import { settingsAPI } from '@/db/apis/settings-api'
import { searchUsers } from '@/services/search-service'

const STORAGE_KEY = 'bastyonNameAddressMap'
/** Лимит размера persisted-карты — чтобы не разбухала бесконечно. */
const MAX_PERSISTED_ENTRIES = 5000

interface PersistedShape {
  /** Map: lowercased name → address. */
  map: Record<string, string>
}

const nameToAddress = new Map<string, string>()
let isLoaded = false
let pendingPersist: ReturnType<typeof setTimeout> | null = null

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/** Поднимает persisted-карту в память. Идемпотентен. */
export async function ensureUserResolverLoaded(): Promise<void> {
  if (isLoaded) return
  isLoaded = true
  try {
    const raw = (await settingsAPI.get(STORAGE_KEY)) as PersistedShape | undefined
    if (raw?.map && typeof raw.map === 'object') {
      for (const [name, address] of Object.entries(raw.map)) {
        if (typeof name === 'string' && typeof address === 'string' && address) {
          if (!nameToAddress.has(name)) nameToAddress.set(name, address)
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load name→address cache:', e)
  }
}

/**
 * Добавляет одну или несколько пар name/address в кеш. Объекты без
 * имени или адреса игнорируются. Запись в IDB дебаунсится на 300 мс,
 * чтобы массовая регистрация (например, после загрузки страницы поиска)
 * не превращалась в 50 последовательных writes.
 */
export function registerNameAddress(
  entries: ReadonlyArray<{ address?: string | null; name?: string | null }>
): void {
  let changed = false
  for (const e of entries) {
    if (!e?.address || !e.name) continue
    const key = normalizeName(e.name)
    if (!key) continue
    const prev = nameToAddress.get(key)
    if (prev === e.address) continue
    nameToAddress.set(key, e.address)
    changed = true
  }
  if (changed) schedulePersist()
}

/** Синхронный лукап по уже загруженному кешу. Без IDB — для быстрого пути. */
export function resolveNameLocal(name: string): string | null {
  const key = normalizeName(name)
  if (!key) return null
  return nameToAddress.get(key) ?? null
}

/**
 * Удалённый резолв через `searchusers`: запрашиваем результаты и
 * считаем «exact match», если найден профиль с точным совпадением
 * имени (без учёта регистра). Найденный профиль попадает в локальный
 * кеш, поэтому следующий вызов того же ника будет синхронным.
 */
export async function resolveNameRemote(name: string): Promise<string | null> {
  const key = normalizeName(name)
  if (!key) return null

  // Сначала проверим локальный кеш — на случай, если за время вызова
  // его уже подтянули из другого места.
  const local = resolveNameLocal(name)
  if (local) return local

  try {
    const results = await searchUsers(key, { count: 7 })
    for (const u of results) {
      if (u.name && normalizeName(u.name) === key && u.address) {
        registerNameAddress([{ name: u.name, address: u.address }])
        return u.address
      }
    }
  } catch (e) {
    console.warn('resolveNameRemote failed:', e)
  }
  return null
}

function schedulePersist(): void {
  if (pendingPersist) return
  pendingPersist = setTimeout(() => {
    pendingPersist = null
    void persistNow()
  }, 300)
}

async function persistNow(): Promise<void> {
  try {
    // Сжимаем до лимита: оставляем последние записи. Map сохраняет порядок
    // вставки, так что свежие записи попадут в конец и переживут урезание.
    const entries = Array.from(nameToAddress.entries())
    const trimmed =
      entries.length > MAX_PERSISTED_ENTRIES ? entries.slice(-MAX_PERSISTED_ENTRIES) : entries
    const map: Record<string, string> = {}
    for (const [k, v] of trimmed) map[k] = v
    await settingsAPI.set(STORAGE_KEY, { map } satisfies PersistedShape)
  } catch (e) {
    console.warn('Failed to persist name→address cache:', e)
  }
}

/** Тестовый хук: сбрасывает и in-memory кеш, и флаг загрузки. */
export function __resetUserResolverForTests(): void {
  nameToAddress.clear()
  isLoaded = false
  if (pendingPersist) {
    clearTimeout(pendingPersist)
    pendingPersist = null
  }
}
