// Обновление профиля пользователя (имя, about, сайт, язык, аватар) через
// on-chain транзакцию `userInfo` — тот же механизм, что и при регистрации,
// но с уже существующего аккаунта (legacy: usersettings actions.save()).
//
// Сериализация/payload — через готовые serializeUserInfo/exportUserInfo
// (формат 1:1 с legacy kit.js). Ключи мессенджера (`k`) детерминированы из
// приватного ключа и ВСЕГДА ре-деривятся, чтобы апдейт их не потерял.
// Крипто-адреса (`b`) сохраняются как есть (их редактирование — вне этого флоу).

import { useAuthStore } from '@/blockchain'
import { serializeUserInfo, exportUserInfo, type UserInfoData } from './user-info-action'
import { buildTransaction } from '../transactions/transaction-builder'
import { sendTransactionWithMessage } from '../transactions/transaction-sender'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
} from '../transactions/unspents-manager'
import { deriveMessengerKeys } from '../keys/key-generator'
import { DEFAULT_TX_FEE } from '../../constants/transactions'
import { t } from '@/i18n'

/** Поля, которые редактируются в edit-profile флоу. */
export interface ProfileUpdateInput {
  name: string
  about?: string
  site?: string
  language?: string
  /** Аватар: уже загруженный URL (data-URI нужно предварительно загрузить). */
  image?: string
  /** Существующие крипто-адреса профиля (поле `b`) — передаём, чтобы не затереть. */
  addresses?: unknown[]
}

/**
 * Собирает и отправляет userInfo-транзакцию с обновлёнными данными профиля.
 * Возвращает txid.
 */
export async function updateUserProfileInfo(input: ProfileUpdateInput): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('editProfile.errAuthRequired'))

  const name = (input.name || '').trim()
  if (!name) throw new Error(t('editProfile.errNameRequired'))

  // Ключи мессенджера детерминированы из приватного ключа — ре-деривим (как legacy
  // на save), иначе апдейт профиля стёр бы их и сломал расшифровку сообщений.
  const publicKeys = deriveMessengerKeys(keyPair.privateKey).map((k) => k.public)

  const userInfoData: UserInfoData = {
    name,
    about: input.about || '',
    site: input.site || '',
    language: input.language || '',
    image: input.image || '',
    addresses: (input.addresses as string[]) || [],
    ref: '',
    keys: publicKeys,
  }

  const serializedData = serializeUserInfo(userInfoData)
  const messageData = exportUserInfo(userInfoData, false)

  let unspents = await getUnspents(address, 0, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('editProfile.errNoUnspents'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('editProfile.errNoUnspents'))

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'userInfo',
    fee: DEFAULT_TX_FEE,
  })

  return sendTransactionWithMessage({
    hex: builtTx.hex,
    messageData,
    operationType: 'userInfo',
  })
}
