import { beforeEach, describe, expect, it, vi } from 'vitest'

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { warning } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { tooLargeForChat } from './too-large-for-chat'

const MB = 1024 * 1024
function file(name: string, type: string, size: number): File {
  const f = new File([''], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => warning.mockClear())

describe('tooLargeForChat', () => {
  it('в пределах лимита — отправляем молча', () => {
    expect(tooLargeForChat(file('a.zip', 'application/zip', 25 * MB), true)).toBe(false)
    expect(tooLargeForChat(file('a.png', 'image/png', 90 * MB), true)).toBe(false)
    expect(warning).not.toHaveBeenCalled()
  })

  it('больше лимита — предупреждение с подсказкой: на десктопе про IPFS, в вебе про приложение', () => {
    expect(tooLargeForChat(file('a.zip', 'application/zip', 26 * MB), true)).toBe(true)
    expect(warning).toHaveBeenLastCalledWith({
      message: 'messenger.fileTooLarge',
      description: 'messenger.fileTooLargeIpfs',
    })
    expect(tooLargeForChat(file('b.png', 'image/png', 101 * MB), false)).toBe(true)
    expect(warning).toHaveBeenLastCalledWith({
      message: 'messenger.fileTooLarge',
      description: 'messenger.fileTooLargeDesktop',
    })
  })
})
