// Напоминание о резервной копии (VP-8): через 8 с после входа, если бэкап не
// проверен или проверка старше 90 дней, — не чаще раза в 7 дней; выход, смена
// аккаунта и размонтирование отменяют отложенный тост. Логика сроков — настоящая
// (helpers/backup поверх localStorage), подменены только стор, роутер и тост.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { BACKUP_NUDGED_AT_KEY } from '@/blockchain/constants/storage'
import {
  markBackupNudged,
  markBackupVerified,
  NUDGE_INTERVAL_MS,
  STALE_AFTER_MS,
} from '@/helpers/backup/backup-verification'

const auth = vi.hoisted(() => ({
  state: null as null | { isUserAuthenticated: boolean; getUserAddress: string | null },
}))
vi.mock('@/stores', () => ({ useAuthStore: () => auth.state }))
const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
const toast = vi.hoisted(() => ({ warning: vi.fn() }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { useBackupNudge } from './use-backup-nudge'

const NOW = 1_800_000_000_000
const DELAY = 8_000
const PA = 'PAccountAaaaaaaaaaaaaaaaaaaaaaaaaa'
const PB = 'PAccountBbbbbbbbbbbbbbbbbbbbbbbbbb'

function signedIn(address: string | null) {
  auth.state!.isUserAuthenticated = !!address
  auth.state!.getUserAddress = address
}

function mountNudge(enabled?: () => boolean) {
  return mount(
    defineComponent({
      setup() {
        useBackupNudge(enabled)
        return () => h('div')
      },
    })
  )
}

describe('useBackupNudge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
    vi.clearAllMocks()
    auth.state = reactive({ isUserAuthenticated: false, getUserAddress: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('бэкап не проверен — через 8 с после входа тост, клик ведёт к приватному ключу', async () => {
    signedIn(PA)
    mountNudge()

    await vi.advanceTimersByTimeAsync(DELAY - 1)
    expect(toast.warning).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(toast.warning).toHaveBeenCalledTimes(1)
    const opts = toast.warning.mock.calls[0]![0]
    expect(opts).toMatchObject({
      message: 'vault.backupNudgeTitle',
      description: 'vault.backupNudgeBody',
    })
    opts.onClick()
    expect(router.push).toHaveBeenCalledWith({ name: 'settings', query: { tab: 'privateKey' } })
    // Отметка «напоминали» — чтобы следующий запуск не повторил тост сразу.
    expect(localStorage.getItem(BACKUP_NUDGED_AT_KEY)).toBe(String(NOW + DELAY))
  })

  it('свежая проверка бэкапа — молчит', async () => {
    markBackupVerified(PA, NOW - 1_000)
    signedIn(PA)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('проверка старше 90 дней — снова напоминает', async () => {
    markBackupVerified(PA, NOW - STALE_AFTER_MS - 1)
    signedIn(PA)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('напоминали меньше недели назад — молчит, через неделю — напоминает', async () => {
    markBackupNudged(NOW - NUDGE_INTERVAL_MS + 60_000)
    signedIn(PA)
    const w = mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).not.toHaveBeenCalled()
    w.unmount()

    vi.setSystemTime(NOW + 60_000)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('битая отметка «напоминали» в хранилище не глушит напоминание навсегда', async () => {
    localStorage.setItem(BACKUP_NUDGED_AT_KEY, 'garbage')
    signedIn(PA)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('гость — ничего не планируется; вход позже — напоминание после входа', async () => {
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY * 2)
    expect(toast.warning).not.toHaveBeenCalled()

    signedIn(PA)
    await nextTick()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('выход до истечения паузы — тоста нет', async () => {
    signedIn(PA)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY / 2)
    signedIn(null)
    await nextTick()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(localStorage.getItem(BACKUP_NUDGED_AT_KEY)).toBeNull()
  })

  it('смена аккаунта во время паузы — отсчёт заново, тост один, уже для нового', async () => {
    signedIn(PA)
    mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY / 2)

    signedIn(PB)
    await nextTick()
    // В момент, когда сработал бы таймер прежнего аккаунта, — тишина.
    await vi.advanceTimersByTimeAsync(DELAY / 2)
    expect(toast.warning).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DELAY / 2)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('пока напоминания выключены (enabled = false) — молчит', async () => {
    signedIn(PA)
    mountNudge(() => false)
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(localStorage.getItem(BACKUP_NUDGED_AT_KEY)).toBeNull()
  })

  it('размонтирование отменяет отложенный тост', async () => {
    signedIn(PA)
    const w = mountNudge()
    await vi.advanceTimersByTimeAsync(DELAY / 2)
    w.unmount()
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(toast.warning).not.toHaveBeenCalled()
  })
})
