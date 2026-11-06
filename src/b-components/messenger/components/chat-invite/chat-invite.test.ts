// Окно приглашения в чат: кто пригласил, «Принять» и «Отклонить», как в
// прежнем клиенте. Раньше чат вступал сам при открытии, а окна не было.
// Стор подменён, окно настоящее.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'
import type { Dialog } from '../../types'

const mocks = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  fetchProfiles: vi.fn(async () => {}),
  userProfiles: {} as Record<string, { name?: string }>,
}))

vi.mock('../../store', () => ({
  useMessengerStore: () => ({
    acceptInvite: mocks.acceptInvite,
    declineInvite: mocks.declineInvite,
    fetchProfiles: mocks.fetchProfiles,
    userProfiles: mocks.userProfiles,
  }),
}))

import ChatInvite from './chat-invite.vue'

const BOB = '@bob:host'

let wrapper: VueWrapper | null = null

const text = (): string => wrapper?.text().replace(/\s+/g, ' ') ?? ''

function direct(): Dialog {
  return {
    id: '!dm:host',
    partner: { id: BOB, name: 'Боб', verified: false, mark: null },
    unreadCount: 0,
    invite: { by: BOB },
  } as Dialog
}

function group(): Dialog {
  return {
    id: '!grp:host',
    partner: { id: '!grp:host', name: '@Велосипеды', verified: false, mark: null },
    group: { memberCount: 3, previewIds: [] },
    unreadCount: 0,
    invite: { by: BOB },
  } as unknown as Dialog
}

function open(dialog: Dialog | null, inviterId = BOB): void {
  wrapper = mount(ChatInvite, {
    props: { chatId: dialog?.id ?? '!dm:host', dialog, inviterId },
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  for (const k of Object.keys(mocks.userProfiles)) delete mocks.userProfiles[k]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('окно приглашения в чат', () => {
  it('личный чат: кто пригласил и обе кнопки', () => {
    open(direct())
    expect(text()).toContain('Боб приглашает вас в чат')
    expect(wrapper!.find('[data-testid="invite-accept"]').text()).toBe('Принять')
    expect(wrapper!.find('[data-testid="invite-decline"]').text()).toBe('Отклонить')
  })

  it('группа: название группы и тот, кто пригласил', () => {
    mocks.userProfiles['bob'] = { name: 'Боб' }
    open(group())
    expect(text()).toContain('приглашает вас в группу «@Велосипеды»')
  })

  it('кто пригласил в группу, неизвестно — без id комнаты вместо имени', () => {
    open(group(), '!grp:host')
    expect(text()).toContain('Вас приглашают в группу «@Велосипеды»')
  })

  it('«Принять» вступает в этот чат и ждёт, пока синк принесёт вступление', async () => {
    let resolve!: () => void
    mocks.acceptInvite.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    open(direct())
    await wrapper!.find('[data-testid="invite-accept"]').trigger('click')
    expect(mocks.acceptInvite).toHaveBeenCalledWith('!dm:host')
    expect(text()).toContain('Приглашение принимается…')
    expect(wrapper!.find('[data-testid="invite-decline"]').attributes('disabled')).toBeDefined()
    resolve()
    await flushPromises()
  })

  it('«Отклонить» выходит из чата', async () => {
    open(direct())
    await wrapper!.find('[data-testid="invite-decline"]').trigger('click')
    expect(mocks.declineInvite).toHaveBeenCalledWith('!dm:host')
    expect(mocks.acceptInvite).not.toHaveBeenCalled()
  })

  it('сбой связи — можно попробовать ещё раз', async () => {
    mocks.acceptInvite.mockRejectedValueOnce(new Error('network'))
    open(direct())
    await wrapper!.find('[data-testid="invite-accept"]').trigger('click')
    await flushPromises()
    expect(text()).toContain('Не удалось принять приглашение')
    expect(wrapper!.find('[data-testid="invite-accept"]').exists()).toBe(true)
  })

  it('сервер отказал (пригласивший вышел) — только убрать из списка', async () => {
    mocks.acceptInvite.mockRejectedValueOnce({ errcode: 'M_FORBIDDEN', httpStatus: 403 })
    open(direct())
    await wrapper!.find('[data-testid="invite-accept"]').trigger('click')
    await flushPromises()
    expect(text()).toContain('Вступить нельзя')
    expect(wrapper!.find('[data-testid="invite-accept"]').exists()).toBe(false)
    const remove = wrapper!.findAll('button').find((b) => b.text() === 'Убрать из списка')
    await remove!.trigger('click')
    expect(mocks.declineInvite).toHaveBeenCalledWith('!dm:host')
  })
})
