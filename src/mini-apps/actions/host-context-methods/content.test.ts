import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Router } from 'vue-router'
import { createContentMethods } from './content'

function makeRouter() {
  return { push: vi.fn() } as unknown as Router & { push: ReturnType<typeof vi.fn> }
}

describe('createContentMethods.openPost', () => {
  it('пушит на / с query.p = txid', async () => {
    const router = makeRouter()
    await createContentMethods({ router }).openPost('txid123')
    expect(router.push).toHaveBeenCalledWith({ path: '/', query: { p: 'txid123' } })
  })
})

describe('createContentMethods.openDonation', () => {
  it('пушит на профиль получателя', async () => {
    const router = makeRouter()
    await createContentMethods({ router }).openDonation('PRECEIVER')
    expect(router.push).toHaveBeenCalledWith('/PRECEIVER')
  })
})

describe('createContentMethods.openExternalLink', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('открывает window.open с _blank и noopener,noreferrer', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const router = makeRouter()
    await createContentMethods({ router }).openExternalLink('https://example.com')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })
})

describe('createContentMethods.share', () => {
  let router: ReturnType<typeof makeRouter>

  beforeEach(() => {
    router = makeRouter()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('onBastyon: открывает форму поста с pre-fill из data.url', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods({ router }).share({ url: 'https://x.io/p' }, { onBastyon: true })
    expect(router.push).toHaveBeenCalledWith({ path: '/', query: { share: 'https://x.io/p' } })
  })

  it('onBastyon: строит url из data.path относительно origin (срезает ведущие слэши)', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods({ router }).share({ path: '//foo/bar' }, { onBastyon: true })
    expect(router.push).toHaveBeenCalledWith({
      path: '/',
      query: { share: 'https://b.io/foo/bar' },
    })
  })

  it('onBastyon: без url/path — использует window.location.href', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods({ router }).share({}, { onBastyon: true })
    expect(router.push).toHaveBeenCalledWith({
      path: '/',
      query: { share: 'https://b.io/cur' },
    })
  })

  it('использует Web Share API, когда navigator.share есть', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    await createContentMethods({ router }).share({ url: 'https://x.io/p' })
    expect(share).toHaveBeenCalledWith({ url: 'https://x.io/p' })
    expect(writeText).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('fallback на clipboard, если Web Share бросил (отмена)', async () => {
    const share = vi.fn().mockRejectedValue(new Error('cancelled'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    await createContentMethods({ router }).share({ url: 'https://x.io/p' })
    expect(writeText).toHaveBeenCalledWith('https://x.io/p')
  })

  it('fallback на clipboard, если navigator.share отсутствует', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await createContentMethods({ router }).share({ url: 'https://x.io/p' })
    expect(writeText).toHaveBeenCalledWith('https://x.io/p')
  })

  it('ничего не делает, если нет ни share, ни clipboard', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', {})
    await expect(
      createContentMethods({ router }).share({ url: 'https://x.io/p' }),
    ).resolves.toBeUndefined()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('createContentMethods.openComplain', () => {
  it('резолвится без побочных эффектов (заглушка)', async () => {
    const router = makeRouter()
    await expect(
      createContentMethods({ router }).openComplain({ txid: 'x' } as never),
    ).resolves.toBeUndefined()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('createContentMethods.getPendingActions', () => {
  it('возвращает пустой массив', () => {
    const router = makeRouter()
    expect(createContentMethods({ router }).getPendingActions()).toEqual([])
  })
})
