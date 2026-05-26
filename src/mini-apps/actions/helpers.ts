/**
 * Helper action handlers (этап 5.1):
 *
 * - `appinfo` — метаданные хоста для миниаппы (legacy [index.js:808-830](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L808-L830))
 * - `alert` — показать сообщение пользователю
 * - `userstate` — проверить, авторизован ли пользователь
 * - `currency` — курсы валют (пока stub — см. TODO в host-context)
 * - `registration` — открыть форму регистрации
 * - `channel` — открыть профиль пользователя по адресу
 * - `opensettings` — открыть настройки приложения
 * - `geolocation` — получить координаты пользователя
 *
 * Все handler'ы возвращают serializable Payload — они уходят через postMessage
 * прямо в iframe миниаппы.
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const appinfo: ActionDefinition<unknown, Record<string, unknown>> = {
  schema: ActionSchemas.appinfo,
  rateLimitClass: 'cheap',
  handler: async ({ app, host }) => ({
    // Legacy флаг — наличие PKOIN-функциональности. В nextgen всегда true,
    // нет глобального disable-флага.
    pkoin: true,
    device: host.device,
    version: host.appVersion,
    production: host.isProduction,
    locale: host.getLocale(),
    theme: host.getTheme(),
    margintop: host.getMarginTop(),
    application: app.manifest,
    project: host.getProject(),
    transactionsApiVersion: host.transactionsApiVersion,
    alttransport: host.isTorActive(),
  }),
}

const alert: ActionDefinition<{ message: string }, void> = {
  schema: ActionSchemas.alert,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    await host.showAlert(data.message)
  },
}

const userstate: ActionDefinition<unknown, boolean> = {
  schema: ActionSchemas.userstate,
  rateLimitClass: 'cheap',
  handler: async ({ host }) => host.isUserAuthenticated(),
}

const currency: ActionDefinition<unknown, Record<string, unknown>> = {
  schema: ActionSchemas.currency,
  rateLimitClass: 'normal',
  handler: async ({ host, signal }) => host.fetchCurrencyRates(signal),
}

const registration: ActionDefinition<unknown, void> = {
  schema: ActionSchemas.registration,
  rateLimitClass: 'normal',
  handler: async ({ host }) => {
    await host.openRegistration()
  },
}

const channel: ActionDefinition<{ address: string }, void> = {
  schema: ActionSchemas.channel,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    await host.openProfile(data.address)
  },
}

const opensettings: ActionDefinition<unknown, void> = {
  schema: ActionSchemas.opensettings,
  rateLimitClass: 'normal',
  handler: async ({ host }) => {
    await host.openSettings()
  },
}

const geolocation: ActionDefinition<unknown, { latitude: number; longitude: number }> = {
  schema: ActionSchemas.geolocation,
  permissions: ['geolocation'],
  rateLimitClass: 'normal',
  handler: async ({ host, signal }) => host.getGeolocation(signal),
}

export const HELPER_ACTIONS = {
  appinfo,
  alert,
  userstate,
  currency,
  registration,
  channel,
  opensettings,
  geolocation,
} as const satisfies ActionMap
