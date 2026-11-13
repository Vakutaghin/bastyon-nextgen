/**
 * Где взять PKOIN — площадки вкладки кошелька «Покупка/продажа».
 *
 * Список правится здесь: сменилась биржа — одна строка. Своего сервера для
 * списка нет и не нужно.
 *
 * Сверено 13.11.2026. Биржи и ссылки на торговые страницы — из CoinGecko
 * (`/api/v3/coins/pocketcoin/tickers`): других пар у PKOIN там нет.
 *
 * Не показываем, хотя были в прежнем приложении (разбор в
 * `_docs-todo/PKOIN_EXCHANGE_ANALYSIS.md`):
 * - pkoin.net (обмен за криптовалюту): страница открывается, но её сервер
 *   `pkoin.net/Shifter/` отвечает 503, купить нельзя. Адрес из ссылки
 *   (`?address=`) сайт больше не читает;
 * - Swipelux (картой) и WPKOIN — встроенные мини-приложения: страница
 *   Swipelux называется «Demo application», манифесты шаблонные. Показывать
 *   после проверки под настоящим аккаунтом.
 */

export interface PkoinExchangeVenue {
  readonly id: string
  readonly name: string
  /** Торговая пара, как её пишет биржа. */
  readonly pair: string
  /** Страница торгов парой. */
  readonly url: string
}

export const PKOIN_EXCHANGES: readonly PkoinExchangeVenue[] = [
  {
    id: 'tapbit',
    name: 'Tapbit',
    pair: 'PKOIN/USDT',
    url: 'https://www.tapbit.com/spot/exchange/PKOIN_USDT',
  },
  {
    id: 'digifinex',
    name: 'DigiFinex',
    pair: 'PKOIN/USDT',
    url: 'https://www.digifinex.com/en-ww/trade/usdt/pkoin',
  },
]

/** Актуальный список бирж — на странице монеты у CoinGecko. */
export const COINGECKO_MARKETS_URL = 'https://www.coingecko.com/en/coins/pocketcoin#markets'

/** PKOIN Exchange — встроенное мини-приложение (id из `mini-apps/registry/built-in.ts`). */
export const PKOIN_EXCHANGE_APP_ID = 'p2p.pkoin.app'
