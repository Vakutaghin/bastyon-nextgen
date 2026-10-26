// Адреса для пожертвований в профиле (поле `b` транзакции userInfo): кошельки в
// других валютах, их показывает окно доната. Список валют и формат записи —
// как у старого клиента (components/test, шаблон addaddress.html):
// `[{"currency":"btc","address":"…"}]`.

/** Кошелёк для пожертвований. */
export interface DonationAddress {
  currency: string
  address: string
}

/** Валюты старого клиента, в его порядке. */
export const DONATION_CURRENCIES: Array<{ value: string; label: string }> = [
  { value: 'btc', label: 'Bitcoin (BTC)' },
  { value: 'eth', label: 'Ethereum (ETH)' },
  { value: 'usdt|erc20', label: 'USDT (ERC20)' },
  { value: 'usdt|trc20', label: 'USDT (TRC20)' },
  { value: 'ltc', label: 'Litecoin (LTC)' },
  { value: 'xmr', label: 'Monero (XMR)' },
  { value: 'bch', label: 'Bitcoin Cash (BCH)' },
  { value: 'dash', label: 'Dash' },
  { value: 'xrp', label: 'Ripple (XRP)' },
  { value: 'zcash', label: 'Zcash (ZEC)' },
  { value: 'etc', label: 'Ethereum Classic (ETC)' },
  { value: 'doge', label: 'Dogecoin (DOGE)' },
]

/** Подпись валюты; незнакомую показываем как записано. */
export function donationCurrencyLabel(currency: string): string {
  return (
    DONATION_CURRENCIES.find((c) => c.value === currency)?.label ??
    currency.replace('|', ' ').toUpperCase()
  )
}

const BASE58 = '[1-9A-HJ-NP-Za-km-z]'
const BECH32 = '[02-9ac-hj-np-z]'
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * Форма адреса по валюте. Старый клиент брал wallet-address-validator; здесь —
 * проверка формы (алфавит, префикс, длина), контрольную сумму не считаем.
 */
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  btc: new RegExp(`^([13]${BASE58}{25,34}|bc1${BECH32}{11,87})$`),
  eth: HEX_ADDRESS,
  'usdt|erc20': HEX_ADDRESS,
  etc: HEX_ADDRESS,
  'usdt|trc20': new RegExp(`^T${BASE58}{33}$`),
  ltc: new RegExp(`^([LM3]${BASE58}{26,33}|ltc1${BECH32}{11,87})$`),
  xmr: new RegExp(`^[48]${BASE58}{94}(${BASE58}{11})?$`),
  bch: new RegExp(`^((bitcoincash:)?[qp]${BECH32}{41}|[13]${BASE58}{25,34})$`),
  dash: new RegExp(`^X${BASE58}{33}$`),
  xrp: new RegExp(`^r${BASE58}{24,34}$`),
  zcash: new RegExp(`^(t[13]${BASE58}{33}|zs1${BECH32}{75})$`),
  doge: new RegExp(`^D${BASE58}{33}$`),
}

/** Похож ли адрес на адрес этой валюты. Bech32 пишут и заглавными — сверяем строчными. */
export function isValidDonationAddress(currency: string, address: string): boolean {
  const pattern = ADDRESS_PATTERNS[currency]
  const value = address.trim()
  if (!pattern || !value) return false
  if (pattern.test(value)) return true
  const lower = value.toLowerCase()
  return lower !== value && /^(bc1|ltc1|bitcoincash:|zs1)/.test(lower) && pattern.test(lower)
}

function isDonationAddress(value: unknown): value is DonationAddress {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.currency === 'string' && typeof v.address === 'string'
}

/**
 * Разбирает поле `b`. Старые клиенты заворачивали прежнее значение в новое
 * строкой (`["[]"]`, `["[{…}]", {…}]`) — разворачиваем вложенное, как
 * `extractDeep` старого клиента, и убираем повторы.
 */
export function parseDonationAddresses(raw: string | null | undefined): DonationAddress[] {
  const out: DonationAddress[] = []
  const seen = new Set<string>()
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5) return
    if (typeof value === 'string') {
      try {
        visit(JSON.parse(value), depth + 1)
      } catch {
        // не JSON — не адрес
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1)
      return
    }
    if (isDonationAddress(value)) {
      const entry = { currency: value.currency, address: value.address }
      const key = `${entry.currency}\n${entry.address}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(entry)
      }
    }
  }
  visit(raw || '[]', 0)
  return out
}
