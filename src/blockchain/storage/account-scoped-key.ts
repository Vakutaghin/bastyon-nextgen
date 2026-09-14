/**
 * Ключи локальных данных, привязанные к аккаунту (Р5: избранное, черновики,
 * история поиска, фильтры уведомлений — per-account, а не «на устройство»).
 *
 * Формат: `<base>:<address>`. Без адреса (аноним) — голый `base`; он же —
 * legacy-ключ, под которым данные лежали до привязки: при первом чтении
 * аккаунтом legacy-значение переезжает к нему (миграция «на текущий адрес»).
 */

export function accountScopedKey(base: string, address: string | null | undefined): string {
  return address ? `${base}:${address}` : base
}

/**
 * localStorage: если у аккаунта своего значения ещё нет, а legacy есть —
 * переносим (один раз, первому аккаунту, который спросил).
 */
export function adoptLegacyLocalKey(base: string, address: string | null | undefined): void {
  if (!address) return
  try {
    const scoped = accountScopedKey(base, address)
    if (localStorage.getItem(scoped) !== null) return
    const legacy = localStorage.getItem(base)
    if (legacy === null) return
    localStorage.setItem(scoped, legacy)
    localStorage.removeItem(base)
  } catch {
    /* localStorage недоступен */
  }
}

/**
 * settingsAPI (IDB): то же для ключей настроек. Возвращает значение аккаунта
 * (после миграции, если она случилась).
 */
export async function adoptLegacySettingsKey(
  api: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<unknown>
  },
  base: string,
  address: string | null | undefined
): Promise<unknown> {
  const scoped = accountScopedKey(base, address)
  const own = await api.get(scoped)
  if (own !== undefined || !address) return own
  const legacy = await api.get(base)
  if (legacy === undefined) return undefined
  await api.set(scoped, legacy)
  await api.set(base, undefined)
  return legacy
}
