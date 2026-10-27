// Стор раскладки: пока человек ничего не трогал, хранится «по умолчанию», а
// не снимок — новые пункты и улучшенный порядок доходят до него сами;
// вернул как было — снова «по умолчанию». «Настройки» скрыть нельзя.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ saved: null as unknown, set: vi.fn() }))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: vi.fn(async () => mocks.saved),
    set: mocks.set,
  },
}))

import { useHeaderLayoutStore } from './header-layout-store'
import { DEFAULT_HEADER_LAYOUT } from './header-layout'

const visibleIds = (list: { id: string; visible: boolean }[]) =>
  list.filter((e) => e.visible).map((e) => e.id)

describe('useHeaderLayoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.saved = null
    mocks.set.mockReset()
  })

  it('без сохранённого — раскладка по умолчанию, и хранить нечего', async () => {
    const store = useHeaderLayoutStore()
    await store.ensureLoaded()
    expect(store.headerLayout).toEqual(DEFAULT_HEADER_LAYOUT)
    expect(store.customized).toEqual({ header: false, menu: false })
  })

  it('скрыть и переставить — своя раскладка сохраняется; вернуть — снова по умолчанию', async () => {
    const store = useHeaderLayoutStore()
    await store.ensureLoaded()
    await store.setVisible('header', 'theme', false)
    await store.move('header', 2, 0)
    expect(visibleIds(store.headerLayout)).toEqual([
      'messenger',
      'services',
      'notifications',
      'tor',
      'ipfs',
    ])
    expect(mocks.set).toHaveBeenLastCalledWith('headerLayout', {
      header: expect.arrayContaining([{ id: 'theme', visible: false }]),
    })
    expect(store.customized.header).toBe(true)

    await store.reset('header')
    expect(store.headerLayout).toEqual(DEFAULT_HEADER_LAYOUT)
    expect(mocks.set).toHaveBeenLastCalledWith('headerLayout', {})
  })

  it('вернул руками ровно как было — тоже «по умолчанию»', async () => {
    const store = useHeaderLayoutStore()
    await store.ensureLoaded()
    await store.move('menu', 0, 1)
    await store.move('menu', 1, 0)
    expect(store.customized.menu).toBe(false)
  })

  it('«Настройки» из меню не скрываются', async () => {
    const store = useHeaderLayoutStore()
    await store.ensureLoaded()
    await store.setVisible('menu', 'settings', false)
    expect(store.menuLayout.find((e) => e.id === 'settings')?.visible).toBe(true)
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it('сохранённое читается один раз на всех, кто просит', async () => {
    mocks.saved = {
      menu: [
        { id: 'wallets', visible: true },
        { id: 'profile', visible: true },
      ],
    }
    const store = useHeaderLayoutStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded()])
    expect(store.menuLayout[0]?.id).toBe('wallets')
    expect(store.customized).toEqual({ header: false, menu: true })
  })
})
