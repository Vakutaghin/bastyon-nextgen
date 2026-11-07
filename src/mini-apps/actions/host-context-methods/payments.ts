/**
 * HostContext methods: payment-диалог и ext-платежи.
 *
 * `openPaymentDialog` поднимает singleton-модал через
 * [payment-modal-controller.ts](../../ui/payment-modal-controller.ts) и ждёт
 * подтверждения или отказа пользователя. Сам модал отрисовывается в src.vue.
 * Отправленный платёж записывается действием приложения (tx/app-actions):
 * ответ — объект действия, как `makeAction` прежнего клиента, а когда перевод
 * попадёт в блок, приложению придёт событие `action`.
 *
 * `openExternalPayment` — платёж по ссылке магазина (tx/ext-payment.ts): то же
 * окно оплаты с магазином, товарами и сроком ссылки; после перевода — сообщить
 * магазину (tx/ext-callback.ts). Отвечает сразу после открытия окна, как
 * прежний клиент.
 */

import type { HostContext } from '../host-context'
import type { ComposerSharePrefill } from '@/b-components/content/post-composer/composer-source'
import { t } from '@/i18n'
import {
  openPaymentModal,
  paymentModalBusy,
  type PaymentDetails,
  type PaymentResult,
} from '../../ui/payment-modal-controller'
import { exportAction, recordSentAction } from '../../tx/app-actions'
import {
  ExtLinkError,
  extPaymentMessage,
  parseExtLink,
  type ExtPayment,
} from '../../tx/ext-payment'
import type { MerchantContacts } from '../../tx/ext-callback'
import { sharePostPrefill } from './share-post'

export type PaymentMethods = Pick<HostContext, 'openPaymentDialog' | 'openExternalPayment'>

export interface PaymentDeps {
  getUserAddress: () => string | null
  /** Окно поста с заготовкой: `share` в ссылке. */
  openComposer?: (share: ComposerSharePrefill) => Promise<void>
  notifyMerchant?: (
    p: ExtPayment,
    tx: string,
    contacts: MerchantContacts,
    account: string | null
  ) => Promise<unknown>
  /** Предупредить человека (перевод ушёл, а магазин не ответил). */
  warn?: (message: string) => Promise<void>
}

/** Ошибка ссылки — в форме прежнего клиента, код — для разработчика приложения. */
function notOpened(code: string, cause?: unknown): Error {
  return Object.assign(new Error('application:ext:notopened', { cause }), { code })
}

function extDetails(p: ExtPayment): PaymentDetails {
  const d: PaymentDetails = {}
  if (p.description) d.description = p.description
  if (p.store) d.store = p.store
  if (p.items?.length) d.items = p.items.map(({ name, value, count }) => ({ name, value, count }))
  if (p.expiresAt) d.expiresAt = p.expiresAt
  if (p.callback) {
    d.callbackHost = new URL(p.callback.url).host
    d.sharesAccount = !p.anonimus
  }
  if (p.email) d.askEmail = true
  if (p.phone) d.askPhone = true
  return d
}

interface PaymentRequest {
  recievers: unknown
  feemode: unknown
  message: string
}

/** Запись перевода действием приложения: приложению придёт событие `action`. */
function recordPayment(appId: string, owner: string, transaction: string, p: PaymentRequest) {
  return recordSentAction({
    application: appId,
    owner,
    type: 'transaction',
    expObject: {
      type: 'transaction',
      source: [owner],
      recievers: p.recievers ?? null,
      feemode: p.feemode ?? null,
      message: p.message,
    },
    transaction,
  })
}

export function createPaymentMethods(deps: PaymentDeps): PaymentMethods {
  /** Перевод по ссылке ушёл: записать действием приложения и сообщить магазину. */
  async function afterExtPayment(
    p: ExtPayment,
    request: PaymentRequest,
    result: PaymentResult,
    appId: string | undefined
  ): Promise<void> {
    if (!result.transaction) return
    const owner = deps.getUserAddress()
    if (owner && appId) recordPayment(appId, owner, result.transaction, request)
    if (!p.callback || !deps.notifyMerchant) return
    try {
      await deps.notifyMerchant(p, result.transaction, result.contacts ?? {}, owner)
    } catch (e) {
      console.warn('[mini-apps] merchant callback failed', e)
      await deps.warn?.(t('miniapps.extMerchantFailed', { host: new URL(p.callback.url).host }))
    }
  }

  return {
    openPaymentDialog: async (payment, appName, appId, signal) => {
      const result = await openPaymentModal(payment, appName, signal)
      const owner = deps.getUserAddress()
      if (!result.transaction || !owner || !appId) {
        return result as unknown as Record<string, unknown>
      }
      const p = (payment ?? {}) as Record<string, unknown>
      const record = recordPayment(appId, owner, result.transaction, {
        recievers: p.recievers,
        feemode: p.feemode,
        message: typeof p.message === 'string' ? p.message : '',
      })
      return exportAction(record)
    },

    openExternalPayment: async (extHash, appName = '', appId) => {
      let link
      try {
        link = parseExtLink(extHash)
      } catch (e) {
        const code = e instanceof ExtLinkError ? e.code : 'wrong:hash'
        if (code === 'application:ext:auth:deprecated') throw new Error(code, { cause: e })
        throw notOpened(code, e)
      }

      if (link.action === 'share') {
        if (!deps.openComposer) throw notOpened('share:unavailable')
        const { description, url, tags } = link.share
        await deps.openComposer(
          sharePostPrefill({ text: { body: description ?? '' }, tags }, url ?? '', appName)
        )
        return 'application:ext:opened'
      }

      const p = link.payment
      // Доставка: форма адреса и цена от магазина (`s_url`) не сделаны —
      // оплатить без доставки было бы хуже, чем отказать.
      if (p.shipment) throw notOpened('shipment:notsupported')
      if (p.expiresAt && p.expiresAt <= Date.now()) throw notOpened('expired')
      if (paymentModalBusy()) throw notOpened('busy')

      const request = {
        recievers: [{ address: p.address, amount: p.value }],
        feemode: 'exclude' as const,
        message: extPaymentMessage(p),
      }
      const pending = openPaymentModal(request, appName, undefined, extDetails(p))
      void pending.then((result) => afterExtPayment(p, request, result, appId))
      return 'application:ext:opened'
    },
  }
}
