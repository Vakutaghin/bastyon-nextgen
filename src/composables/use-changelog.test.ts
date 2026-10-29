// «Что нового» — один раз на версию, даже если база на устройстве не открылась:
// на macOS с базой ранней сборки окно всплывало на каждом запуске.

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const h = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('@/db/apis/settings-api', () => ({ settingsAPI: { get: h.get, set: h.set } }))

import { useWhatsNewGate } from './use-changelog'
import { getChangelogEntryForVersion } from '@/helpers/changelog/changelog-loader'

const KEY = 'bastyonChangelogLastSeenVersion'

function setup(): ReturnType<typeof useWhatsNewGate> {
  let gate!: ReturnType<typeof useWhatsNewGate>
  mount(
    defineComponent({
      setup() {
        gate = useWhatsNewGate()
        return () => null
      },
    })
  )
  return gate
}

describe('useWhatsNewGate', () => {
  const version = getChangelogEntryForVersion()!.version

  beforeEach(() => {
    localStorage.clear()
    h.get.mockReset()
    h.set.mockReset()
    // База недоступна: settingsAPI отдаёт fallback.
    h.get.mockResolvedValue(undefined)
    h.set.mockResolvedValue(KEY)
  })

  it('без базы окно не открывается снова на той же версии', async () => {
    localStorage.setItem(KEY, version)
    const gate = setup()
    await flushPromises()
    expect(gate.open.value).toBe(false)
  })

  it('закрытое окно запоминается и в базе, и в localStorage', async () => {
    const gate = setup()
    await flushPromises()
    expect(gate.open.value).toBe(true)

    await gate.dismiss()
    expect(gate.open.value).toBe(false)
    expect(localStorage.getItem(KEY)).toBe(version)
    expect(h.set).toHaveBeenCalledWith(KEY, version)
  })

  it('версия из базы важнее копии', async () => {
    h.get.mockResolvedValue('0.0.1')
    localStorage.setItem(KEY, version)
    const gate = setup()
    await flushPromises()
    expect(gate.open.value).toBe(true)
  })
})
