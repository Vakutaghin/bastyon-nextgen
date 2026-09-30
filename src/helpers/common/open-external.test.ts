// Внешние ссылки: в приложении для компьютера — системный браузер через
// opener-плагин, в вебе и на телефоне — новая вкладка. Опасные схемы не
// открываются. Главное — область opener в capabilities: без неё плагин
// отказывал в любой ссылке, и «Смотреть на YouTube», «Поделиться → Twitter»,
// ссылки в постах и чате на компьютере не делали ничего (V40 → 30.09.2026).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ tauri: false, openUrl: vi.fn() }))
vi.mock('@/helpers/api/request-tor', () => ({ isTauriEnv: () => mocks.tauri }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }))

import { ALLOWED_PROTOCOLS, isExternallyOpenable, openExternal } from './open-external'

interface ScopedPermission {
  identifier: string
  allow?: Array<{ url?: string }>
}

const capabilities = JSON.parse(
  readFileSync(resolve(__dirname, '../../../src-tauri/capabilities/default.json'), 'utf8')
) as { permissions: Array<string | ScopedPermission> }

describe('capabilities: область opener', () => {
  it('у каждой схемы, которую приложение отдаёт наружу, есть разрешение', () => {
    const opener = capabilities.permissions.find(
      (p): p is ScopedPermission =>
        typeof p === 'object' && p.identifier === 'opener:allow-open-url'
    )
    expect(opener, 'opener:allow-open-url должен быть с областью allow').toBeDefined()
    const urls = (opener!.allow ?? []).map((entry) => entry.url)
    for (const protocol of ALLOWED_PROTOCOLS) {
      expect(urls).toContain(protocol === 'mailto:' ? 'mailto:*' : `${protocol}//*`)
    }
    // Голая строка без области снова отключила бы все ссылки.
    expect(capabilities.permissions).not.toContain('opener:allow-open-url')
  })
})

describe('openExternal', () => {
  let open: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.tauri = false
    mocks.openUrl.mockReset().mockResolvedValue(undefined)
    open = vi.fn(() => ({}) as Window)
    vi.stubGlobal('open', open)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('на компьютере — системный браузер через opener', async () => {
    mocks.tauri = true
    expect(await openExternal('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(mocks.openUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc')
    expect(open).not.toHaveBeenCalled()
  })

  it('opener отказал — честное false, а не новая вкладка, которой всё равно не будет', async () => {
    mocks.tauri = true
    mocks.openUrl.mockRejectedValue(new Error('Not allowed to open url'))
    expect(await openExternal('https://example.org')).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  it('в вебе и на телефоне — новая вкладка; www. без схемы становится https', async () => {
    expect(await openExternal('www.example.org')).toBe(true)
    expect(open).toHaveBeenCalledWith('https://www.example.org', '_blank', 'noopener,noreferrer')
  })

  it('javascript:, data: и file: наружу не уходят', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', '']) {
      expect(isExternallyOpenable(url)).toBe(false)
      expect(await openExternal(url)).toBe(false)
    }
    expect(open).not.toHaveBeenCalled()
    expect(mocks.openUrl).not.toHaveBeenCalled()
  })
})
