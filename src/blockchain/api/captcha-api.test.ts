import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CaptchaAPI } from './captcha-api'

const _fetchHttp = vi.hoisted(() => vi.fn())

vi.mock('@/helpers/api/request', () => ({ fetchHttp: _fetchHttp }))
vi.mock('../constants/storage', () => ({ CAPTCHA_STORAGE_KEY: 'captcha_key' }))

function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

let api: CaptchaAPI

beforeEach(() => {
  _fetchHttp.mockReset()
  installMemoryLocalStorage()
  api = new CaptchaAPI()
})

afterEach(() => vi.unstubAllGlobals())

describe('get', () => {
  it('запрашивает captcha с auth и возвращает ответ + зовёт callback', async () => {
    _fetchHttp.mockResolvedValue({ id: 'c1', done: false })
    const cb = vi.fn()

    const res = await api.get(cb, false, { host: 'node', port: 8899 })

    expect(res).toEqual({ id: 'c1', done: false })
    expect(cb).toHaveBeenCalledWith({ id: 'c1', done: false })
    expect(_fetchHttp).toHaveBeenCalledWith({
      path: 'captcha',
      data: { captcha: null },
      options: { host: 'node', port: 8899, auth: true },
    })
  })

  it('автоматически решает капчу, если есть result и она не решена', async () => {
    _fetchHttp.mockImplementation(async ({ path }: { path: string }) =>
      path === 'captcha' ? { id: 'c1', result: 'puzzle', done: false } : { id: 'c1' }
    )
    const cb = vi.fn()

    const res = await api.get(cb)

    expect(res).toMatchObject({ id: 'c1', done: true })
    // makecaptcha вызван вторым
    expect(_fetchHttp).toHaveBeenCalledTimes(2)
    expect(_fetchHttp.mock.calls[1][0]).toMatchObject({ path: 'makecaptcha' })
  })

  it('ошибка запроса → callback(null, message), возвращает null', async () => {
    _fetchHttp.mockRejectedValueOnce(new Error('boom'))
    const cb = vi.fn()

    const res = await api.get(cb)

    expect(res).toBeNull()
    expect(cb).toHaveBeenCalledWith(null, 'boom')
  })
})

describe('getHex', () => {
  it('запрашивает captchaHex с языком ru', async () => {
    _fetchHttp.mockResolvedValue({ id: 'h1', done: false })

    await api.getHex()

    expect(_fetchHttp).toHaveBeenCalledWith({
      path: 'captchaHex',
      data: { captcha: null, language: 'ru' },
      options: { auth: true },
    })
  })

  it('авто-решает только при наличии result, !done и angles', async () => {
    _fetchHttp.mockImplementation(async ({ path }: { path: string }) =>
      path === 'captchaHex'
        ? { id: 'h1', result: 'puzzle', done: false, angles: [10, 20] }
        : { id: 'h1' }
    )

    const res = await api.getHex()

    expect(res).toMatchObject({ id: 'h1', done: true })
    expect(_fetchHttp.mock.calls[1][0]).toMatchObject({
      path: 'makecaptcha',
      data: { text: 'puzzle', angles: [10, 20] },
    })
  })

  it('не решает, если нет angles', async () => {
    _fetchHttp.mockResolvedValue({ id: 'h1', result: 'puzzle', done: false })

    await api.getHex()

    expect(_fetchHttp).toHaveBeenCalledTimes(1) // makecaptcha не вызывался
  })
})

describe('make', () => {
  it('отправляет решение, помечает done, сохраняет id в localStorage', async () => {
    _fetchHttp.mockResolvedValue({ id: 'solved-1' })
    const cb = vi.fn()

    const res = await api.make('answer', [1, 2], cb)

    expect(res).toMatchObject({ id: 'solved-1', done: true })
    expect(cb).toHaveBeenCalledWith(null, { id: 'solved-1', done: true })
    expect(localStorage.getItem('captcha_key')).toBe('solved-1')
    expect(_fetchHttp).toHaveBeenCalledWith({
      path: 'makecaptcha',
      data: { captcha: null, text: 'answer', angles: [1, 2] },
      options: { auth: true },
    })
  })

  it('спец-ошибка captchashots → callback("captchashots"), null', async () => {
    _fetchHttp.mockRejectedValueOnce(new Error('error: captchashots limit'))
    const cb = vi.fn()

    const res = await api.make('answer', null, cb)

    expect(res).toBeNull()
    expect(cb).toHaveBeenCalledWith('captchashots')
  })

  it('спец-ошибка captchanotequal_angles → callback соответствующий, null', async () => {
    _fetchHttp.mockRejectedValueOnce(new Error('captchanotequal_angles'))
    const cb = vi.fn()

    await api.make('answer', [1], cb)

    expect(cb).toHaveBeenCalledWith('captchanotequal_angles')
  })

  it('прочая ошибка → callback(message), null', async () => {
    _fetchHttp.mockRejectedValueOnce(new Error('network fail'))
    const cb = vi.fn()

    const res = await api.make('answer', null, cb)

    expect(res).toBeNull()
    expect(cb).toHaveBeenCalledWith('network fail')
  })
})

describe('load / save (round-trip через localStorage)', () => {
  it('load подхватывает сохранённую решённую капчу, get отправляет её как captcha', async () => {
    localStorage.setItem('captcha_key', 'stored-id')
    const fresh = new CaptchaAPI()
    fresh.load()

    _fetchHttp.mockResolvedValue({ id: 'stored-id', done: true })
    await fresh.get()

    expect(_fetchHttp).toHaveBeenCalledWith(
      expect.objectContaining({ data: { captcha: 'stored-id' } })
    )
  })

  it('refresh=true сбрасывает текущую капчу', async () => {
    // первый get выставляет current
    _fetchHttp.mockResolvedValue({ id: 'c1', done: true })
    await api.get()
    _fetchHttp.mockClear()

    // refresh → current сбрасывается, done тоже стал null (id===done выше), значит captcha=null
    _fetchHttp.mockResolvedValue({ id: 'c2', done: true })
    await api.get(undefined, true)

    expect(_fetchHttp).toHaveBeenCalledWith(
      expect.objectContaining({ data: { captcha: null } })
    )
  })
})
