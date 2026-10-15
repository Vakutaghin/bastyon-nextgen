// Настройки аккаунта — on-chain транзакция `accSet` (тип 103): закреплённый
// пост, монетизация, цена платной подписки, обложка профиля.
//
// Формат 1:1 со старым клиентом (kit.js, класс Settings; satolist.js accSetMy):
//   - serialize() = JSON.stringify({ pin, monetization, paidsubscription, cover })
//     именно в этом порядке; OP_RETURN = ['accSet', hash256(serialize())];
//   - тело сообщения = { d: та же строка }.
// Проверено на mainnet: у транзакции c2022326…37d9 хэш в OP_RETURN совпадает с
// hash256 строки, которую возвращает getaccountsetting.
//
// Транзакция пишет настройки целиком, поэтому меняем одно поле поверх текущих:
// не прочитали текущие — не отправляем, иначе стёрли бы обложку и закреплённый пост.

import { useAuthStore } from '@/blockchain'
import { fetchAccountSettings, type AccountSettings } from '@/helpers/api/account-settings'
import { buildTransaction } from '../transactions/transaction-builder'
import { sendTransactionWithMessage } from '../transactions/transaction-sender'
import type { PendingMeta } from '../transactions/broadcast-events'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
} from '../transactions/unspents-manager'
import { DEFAULT_TX_FEE } from '../../constants/transactions'
import { t } from '@/i18n'

/** Поля настроек в том виде, в каком они уходят в сеть. */
export interface AccountSettingsPayload {
  pin: string
  /** '' — не задано; true/false — включена/выключена. */
  monetization: '' | boolean
  /** Цена платной подписки, PKOIN в месяц: 0 — не задана, -1 — отключена. */
  paidsubscription: number
  cover: string
}

/** Настройки с ноды → поля для транзакции, с подстановками старого клиента. */
export function normalizeAccountSettings(raw: AccountSettings): AccountSettingsPayload {
  const price = Number(raw.paidsubscription)
  const monetization = raw.monetization
  return {
    pin: typeof raw.pin === 'string' ? raw.pin : '',
    monetization: monetization === true || monetization === false ? monetization : '',
    paidsubscription: Number.isFinite(price) ? price : 0,
    cover: typeof raw.cover === 'string' ? raw.cover : '',
  }
}

/** Строка, которую хэширует OP_RETURN и хранит нода. Порядок полей важен. */
export function serializeAccountSettings(settings: AccountSettingsPayload): string {
  return JSON.stringify({
    pin: settings.pin,
    monetization: settings.monetization,
    paidsubscription: settings.paidsubscription,
    cover: settings.cover,
  })
}

/**
 * Меняет поля настроек аккаунта поверх текущих и отправляет `accSet`.
 * Возвращает txid и то, что ушло в сеть.
 */
export async function saveAccountSettings(
  patch: Partial<AccountSettingsPayload>,
  pending: PendingMeta = {}
): Promise<{ txid: string; settings: AccountSettingsPayload }> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress
  if (!keyPair || !address) throw new Error(t('paidSubscriptions.errAuthRequired'))

  let current: AccountSettings
  try {
    current = await fetchAccountSettings(address)
  } catch (e) {
    throw new Error(t('paidSubscriptions.errReadSettings'), { cause: e })
  }
  const settings: AccountSettingsPayload = { ...normalizeAccountSettings(current), ...patch }
  const serialized = serializeAccountSettings(settings)

  let unspents = await getUnspents(address, 0, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectAndLockUnspents(unspents, DEFAULT_TX_FEE) // лок входов (S6)
  if (!selected.length) throw new Error(t('paidSubscriptions.errNoFunds'))

  const built = await buildTransaction({
    unspents: selected,
    fromAddress: address,
    keyPair,
    serializedData: serialized,
    operationType: 'accSet',
    fee: DEFAULT_TX_FEE,
  })

  const txid = await sendTransactionWithMessage({
    hex: built.hex,
    messageData: { d: serialized },
    operationType: 'accSet',
    pending,
  })
  return { txid, settings }
}
