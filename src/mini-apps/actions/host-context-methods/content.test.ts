import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Router } from 'vue-router'
import { createContentMethods } from './content'

function makeRouter() {
  return { push: vi.fn() } as unknown as Router & { push: ReturnType<typeof vi.fn> }
}

const openComposer = vi.fn(async () => {})
const complain = vi.fn(async () => true)
const deps = (router: Router) => ({ router, openComposer, complain })

beforeEach(() => {
  openComposer.mockClear()
  complain.mockClear()
})

describe('createContentMethods.openPost', () => {
  it('пушит на / с query.p = txid', async () => {
    const router = makeRouter()
    await createContentMethods(deps(router)).openPost('txid123')
    expect(router.push).toHaveBeenCalledWith({ path: '/', query: { p: 'txid123' } })
  })
})

describe('createContentMethods.openDonation', () => {
  it('пушит на профиль получателя', async () => {
    const router = makeRouter()
    await createContentMethods(deps(router)).openDonation('PRECEIVER')
    expect(router.push).toHaveBeenCalledWith('/PRECEIVER')
  })
})

describe('createContentMethods.openExternalLink', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('открывает window.open с _blank и noopener,noreferrer', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const router = makeRouter()
    await createContentMethods(deps(router)).openExternalLink('https://example.com')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })
})

describe('createContentMethods.share', () => {
  let router: ReturnType<typeof makeRouter>

  beforeEach(() => {
    router = makeRouter()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('onBastyon: открывает окно поста со ссылкой в тексте', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods(deps(router)).share({ url: 'https://x.io/p' }, { onBastyon: true })
    expect(openComposer).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'https://x.io/p' })
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('путь мини-приложения — ссылка application?id=…&p=<hex> на публичном адресе', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods(deps(router)).share(
      { path: '//barter/abc' },
      { onBastyon: true, appId: 'barteron.pocketnet.app' }
    )
    expect(openComposer).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'https://b.io/application?id=barteron.pocketnet.app&p=6261727465722f616263',
      })
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('из приложения (http://tauri.localhost) — ссылка на bastyon.com, а не на себя', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('window', {
      location: { origin: 'http://tauri.localhost', href: 'http://tauri.localhost/app/x' },
    })
    await createContentMethods(deps(router)).share(
      { path: 'item/1' },
      { onBastyon: true, appId: 'x.app' }
    )
    expect(openComposer).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'https://bastyon.com/application?id=x.app&p=6974656d2f31',
      })
    )
    expect(router.push).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('bastyon://-ссылка из SDK (get.applink) — тот же адрес на публичном origin', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    await createContentMethods(deps(router)).share(
      { url: 'bastyon://application?id=x.app&p=6974656d' },
      { onBastyon: true }
    )
    expect(openComposer).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'https://b.io/application?id=x.app&p=6974656d' })
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('использует Web Share API, когда navigator.share есть', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    await createContentMethods(deps(router)).share({ url: 'https://x.io/p' })
    expect(share).toHaveBeenCalledWith({ url: 'https://x.io/p' })
    expect(writeText).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('fallback на clipboard, если Web Share бросил (отмена)', async () => {
    const share = vi.fn().mockRejectedValue(new Error('cancelled'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    await createContentMethods(deps(router)).share({ url: 'https://x.io/p' })
    expect(writeText).toHaveBeenCalledWith('https://x.io/p')
  })

  it('fallback на clipboard, если navigator.share отсутствует', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await createContentMethods(deps(router)).share({ url: 'https://x.io/p' })
    expect(writeText).toHaveBeenCalledWith('https://x.io/p')
  })

  it('ничего не делает, если нет ни share, ни clipboard', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    vi.stubGlobal('navigator', {})
    await expect(
      createContentMethods(deps(router)).share({ url: 'https://x.io/p' })
    ).resolves.toBeUndefined()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('createContentMethods.share — заготовка поста из приложения', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('текст, картинки и теги приложения, к тегам — имя приложения', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    const router = makeRouter()
    await createContentMethods(deps(router)).share(
      {
        path: 'barter/abc',
        sharing: {
          title: '',
          text: { body: 'Велосипед' },
          images: ['https://img.test/1.jpg', 'javascript:alert(1)'],
          tags: ['sale'],
        },
      },
      { onBastyon: true, appId: 'barteron.pocketnet.app', appName: 'Barteron' }
    )
    expect(openComposer).toHaveBeenCalledWith({
      message:
        'Велосипед\n\nhttps://b.io/application?id=barteron.pocketnet.app&p=6261727465722f616263',
      images: ['https://img.test/1.jpg'],
      tags: ['sale', 'Barteron'],
    })
  })
})

describe('createContentMethods.share — SDK без init()', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('в url голый путь (applink не знает приложения) — ссылка на страницу приложения', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://b.io', href: 'https://b.io/cur' } })
    const router = makeRouter()
    await createContentMethods(deps(router)).share(
      { path: 'barter/abc', url: 'barter/abc' },
      { onBastyon: true, appId: 'barteron.pocketnet.app', appName: 'Barteron' }
    )
    expect(openComposer).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'https://b.io/application?id=barteron.pocketnet.app&p=6261727465722f616263',
      })
    )
  })
})

describe('createContentMethods.openComplain', () => {
  const entity = {
    entityLink: '/application?id=barteron.pocketnet.app&p=6261',
    entityTxid: 'a'.repeat(64),
    entityType: 'offer',
  }

  it('открывает окно жалобы с тем, на что жалуются, и ждёт его', async () => {
    const router = makeRouter()
    const signal = new AbortController().signal
    await createContentMethods(deps(router)).openComplain(entity, 'Barteron', signal)
    expect(complain).toHaveBeenCalledWith(
      {
        appName: 'Barteron',
        entity: { link: entity.entityLink, txid: entity.entityTxid, type: 'offer' },
      },
      signal
    )
  })

  it('без ссылки и txid — отказ, окно не открывается', async () => {
    const router = makeRouter()
    await expect(
      createContentMethods(deps(router)).openComplain({ entityType: 'offer' }, 'Barteron')
    ).rejects.toThrow('complain:invalid')
    expect(complain).not.toHaveBeenCalled()
  })
})
