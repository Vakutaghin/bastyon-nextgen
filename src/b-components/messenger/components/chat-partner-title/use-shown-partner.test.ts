// Кто в шапке открытого чата и куда ведёт ссылка: личный чат — к собеседнику,
// у группы и mesh-диалога профиля нет, приглашение — к тому, кому пишем.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

import { setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ store: null as unknown as Record<string, unknown> }))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))

import { addressToHex } from '../../services/matrix-service/address-codec'
import type { Dialog } from '../../types'
import { useShownPartner } from './use-shown-partner'
import { useMessengerChannelsStore } from '../../store/messenger-channels-store'

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

function dialog(id: string, partnerId: string, name: string): Dialog {
  return { id, partner: { id: partnerId, name, avatar: 'https://img/a.png' }, unreadCount: 0 }
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.store = reactive({
    activeChatId: null as string | null,
    dialogs: [
      dialog('!alice:host', `@${addressToHex(ALICE)}:matrix.pocketnet.app`, 'Алиса'),
      {
        ...dialog('!group:host', '!group:host', 'Книжный клуб'),
        group: { memberCount: 5, previewIds: ['@a:host'] },
      },
      dialog('mesh:lx:abcd1234:u:ef567890', 'ef567890', 'Узел у реки'),
    ],
    inviteViewActive: false,
    lastTargetAddress: null as string | null,
    userProfiles: {} as Record<string, unknown>,
    getDirectPartnerAddress: vi.fn(() => null),
  })
})

describe('собеседник в шапке', () => {
  it('личный чат — имя, аватар и адрес собеседника', () => {
    mocks.store.activeChatId = '!alice:host'
    expect(useShownPartner().value).toEqual({
      name: 'Алиса',
      avatar: 'https://img/a.png',
      verified: false,
      mark: null,
      address: ALICE,
      chatId: '!alice:host',
    })
  })

  it('у группы и mesh-диалога профиля нет', () => {
    const shown = useShownPartner()
    mocks.store.activeChatId = '!group:host'
    expect(shown.value).toMatchObject({
      name: 'Книжный клуб',
      address: null,
      chatId: '!group:host',
      group: { memberCount: 5 },
    })
    mocks.store.activeChatId = 'mesh:lx:abcd1234:u:ef567890'
    expect(shown.value).toMatchObject({ name: 'Узел у реки', address: null })
  })

  it('чата ещё нет в списке — адрес берётся у комнаты', () => {
    ;(mocks.store.getDirectPartnerAddress as ReturnType<typeof vi.fn>).mockReturnValue(BOB)
    mocks.store.activeChatId = '!fresh:host'
    expect(useShownPartner().value).toMatchObject({ name: 'Чат', address: BOB })
  })

  it('приглашение — тот, кому пишем, из профиля', () => {
    mocks.store.inviteViewActive = true
    mocks.store.lastTargetAddress = BOB
    mocks.store.userProfiles = { [BOB]: { name: 'bob', badges: ['verified'] } }
    expect(useShownPartner().value).toEqual({
      name: 'bob',
      avatar: undefined,
      verified: true,
      mark: 'verified',
      address: BOB,
      chatId: null,
    })
  })

  it('канал — автор с адресом, имя из ленты, пока профиля нет', () => {
    const shown = useShownPartner()
    useMessengerChannelsStore().summaries = {
      [BOB]: { recent: [], name: 'Боб пишет', checkedAt: 1 },
    }
    mocks.store.activeChatId = `channel:${BOB}`
    expect(shown.value).toMatchObject({
      name: 'Боб пишет',
      address: BOB,
      chatId: `channel:${BOB}`,
      channel: true,
    })
    mocks.store.userProfiles = { [BOB]: { name: 'bob' } }
    expect(shown.value).toMatchObject({ name: 'bob', channel: true })
  })

  it('открыт список чатов — в шапке никого', () => {
    mocks.store.lastTargetAddress = BOB
    expect(useShownPartner().value).toBeNull()
  })
})
