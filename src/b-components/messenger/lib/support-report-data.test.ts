// Что уходит в поддержку: версия, система, экран, язык, настройки, сеть и
// последние ошибки — и ничего из аккаунта. На компьютере система берётся у
// приложения (вебвью врёт про Windows 11 и macOS).

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ desktop: false, invoke: vi.fn(), rpc: vi.fn() }))

vi.mock('@/helpers/api/request-tor', () => ({ isTauriEnv: () => mocks.desktop }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helpers/api/node-selector', () => ({
  currentProxy: () => ({ host: '1.pocketnet.app', port: 8899 }),
}))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.rpc }))
vi.mock('../services/matrix-service', () => ({
  matrixService: { getBaseUrl: () => 'https://matrix.pocketnet.app' },
}))

import { clearRecentErrors, rememberError } from '@/helpers/diagnostics/recent-errors'
import { useMessengerUiStore } from '../store/messenger-ui-store'
import { collectSupportReport, reportJson } from './support-report-data'

const ADDRESS = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'

beforeEach(() => {
  setActivePinia(createPinia())
  clearRecentErrors()
  mocks.desktop = false
  mocks.invoke.mockReset()
  mocks.rpc.mockReset()
  mocks.rpc.mockRejectedValue(new Error('offline'))
})

afterEach(() => clearRecentErrors())

describe('collectSupportReport', () => {
  it('версия, платформа, сеть и ошибки — без адресов', async () => {
    rememberError([`[profile] ${ADDRESS} not found`])
    useMessengerUiStore().syncState = 'SYNCING'
    mocks.rpc.mockResolvedValue({
      result: 'success',
      node: '65.21.56.203:38081',
      // Время блока бывает строкой — так отвечают некоторые ноды.
      data: {
        version: '0.22.16',
        lastblock: { height: 3_456_789, time: String(1_791_288_000 - 180) },
      },
    })
    const report = await collectSupportReport(new Date(1_791_288_000_000))

    expect(report.report).toBe('bastyon-nextgen-support')
    expect(report.generatedAt).toBe(new Date(1_791_288_000_000).toISOString())
    expect(report.utcOffset).toMatch(/^[+-]\d\d:\d\d$/)
    expect(report.app.platform).toBe('web')
    expect(report.app.version).toBeTruthy()
    expect(report.network).toMatchObject({
      node: '1.pocketnet.app:8899',
      nodeServer: '65.21.56.203:38081',
      nodeVersion: '0.22.16',
      blockHeight: 3_456_789,
      blockAgeMin: 3,
      chatServer: 'matrix.pocketnet.app',
      chatSync: 'SYNCING',
    })
    expect(mocks.rpc.mock.calls[0]![0]).toMatchObject({ method: 'getnodeinfo' })
    expect(report.errors.map((e) => e.message)).toEqual(['[profile] <address> not found'])
    expect(reportJson(report)).not.toContain(ADDRESS)
  })

  it('на компьютере система — от приложения', async () => {
    mocks.desktop = true
    mocks.invoke.mockResolvedValue({
      os: 'windows',
      name: 'Windows 11',
      version: '10.0.22631',
      arch: 'x86_64',
    })
    const report = await collectSupportReport()
    expect(mocks.invoke).toHaveBeenCalledWith('system_info')
    expect(report.app.platform).toBe('desktop')
    expect(report.system).toMatchObject({
      name: 'Windows 11',
      version: '10.0.22631',
      arch: 'x86_64',
    })
  })

  it('старая сборка без команды — остаётся строка браузера', async () => {
    mocks.desktop = true
    mocks.invoke.mockRejectedValue(new Error('command system_info not found'))
    const report = await collectSupportReport()
    expect(report.system.userAgent).toBe(navigator.userAgent)
    expect(report.system.name).toBeUndefined()
  })
})
