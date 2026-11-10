import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL, type MockPeerTubeOptions } from './support/mock-peertube'
import { skipFileWithoutWebKitMedia } from './support/webkit-media'

skipFileWithoutWebKitMedia()

/**
 * Обвязка плеера, которой нет в video-player.spec: громкость (кнопка,
 * ползунок, перетаскивание, память между запусками), панель, которая
 * прячется сама, подсказка времени над полосой, субтитры с сервера, качество
 * HLS, волна у звука и жесты пальцем — удержание 2×, двойное касание слева,
 * свайп вниз из полноэкранного режима. Подменные нода и PeerTube.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: 'e'.repeat(64),
      address: ALICE.address,
      message: 'Ролик для проверки плеера',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

const VTT = [
  'WEBVTT',
  '',
  '00:00:00.000 --> 00:00:10.000',
  'Первая реплика',
  '',
  '00:00:10.000 --> 00:00:30.000',
  'Вторая реплика',
  '',
].join('\n')

async function open(page: Page, peertube: MockPeerTubeOptions = {}, data = DATA) {
  await useMockNode(page, data)
  await useMockPeerTube(page, peertube)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const video = (page: Page) => page.locator('video').first()
const container = (page: Page) => video(page).locator('xpath=ancestor::div[@tabindex="0"][1]')
const state = (page: Page) =>
  video(page).evaluate((v: HTMLVideoElement) => ({
    time: v.currentTime,
    paused: v.paused,
    rate: v.playbackRate,
    volume: v.volume,
  }))

async function start(page: Page, tap = false) {
  const play = page.getByRole('button', { name: 'Смотреть', exact: true })
  await play.waitFor({ timeout: 20_000 })
  await play.scrollIntoViewIfNeeded()
  if (tap) await play.tap()
  else await play.click()
  await expect.poll(async () => (await state(page)).time, { timeout: 15_000 }).toBeGreaterThan(0.5)
}

test.describe('Плеер мышью', () => {
  test('громкость: кнопка звука, щелчок и перетаскивание по ползунку, память между запусками', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page)
    await start(page)
    const box = container(page)
    await box.hover()

    await box.getByRole('button', { name: 'Выключить звук (m)' }).click()
    await expect.poll(async () => (await state(page)).volume).toBe(0)
    await box.getByRole('button', { name: 'Включить звук (m)' }).click()
    await expect.poll(async () => (await state(page)).volume).toBe(1)

    // Ползунок выезжает при наведении на кнопку звука.
    await box.getByRole('button', { name: 'Выключить звук (m)' }).hover()
    const slider = box.getByRole('slider', { name: 'Громкость' })
    await expect(slider).toBeVisible()
    // Ползунок выезжает плавно — меряем, когда ширина перестала расти.
    let width = -1
    await expect
      .poll(async () => {
        const prev = width
        width = (await slider.boundingBox())?.width ?? 0
        return width > 0 && width === prev
      })
      .toBe(true)
    const s = (await slider.boundingBox())!
    const y = s.y + s.height / 2
    await page.mouse.click(s.x + s.width * 0.25, y)
    await expect.poll(async () => (await state(page)).volume).toBeCloseTo(0.25, 1)
    await expect(slider).toHaveAttribute('aria-valuenow', /^2\d$/)

    await page.mouse.move(s.x + s.width * 0.25, y)
    await page.mouse.down()
    await page.mouse.move(s.x + s.width * 0.75, y, { steps: 5 })
    // Отпустили уже за пределами ползунка — громкость та, где отпустили.
    await page.mouse.move(s.x + s.width * 0.75, y - 80, { steps: 2 })
    await page.mouse.up()
    await expect.poll(async () => (await state(page)).volume).toBeCloseTo(0.75, 1)
    // Ролик при этом не встал на паузу.
    expect((await state(page)).paused).toBe(false)

    // Следующий запуск — та же громкость.
    await page.reload()
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await start(page)
    expect((await state(page)).volume).toBeCloseTo(0.75, 1)
  })

  test('панель прячется через 3 секунды без движения мыши и сразу — когда мышь ушла', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page)
    await start(page)
    const box = container(page)
    // Спрятанная панель выпадает из дерева доступности — ищем ряд кнопок по имени компонента.
    const row = box.locator('[data-styled-name="SC_ControlsRow"]')
    const shown = /(^|\s)visible(\s|$)/
    const b = (await box.boundingBox())!

    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
    await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 3)
    await expect(row).toHaveClass(shown)
    // Мышь замерла — через 3 с панель уходит, ролик идёт дальше.
    const still = Date.now()
    await expect(row).not.toHaveClass(shown, { timeout: 8_000 })
    expect(Date.now() - still).toBeGreaterThan(2_000)
    expect((await state(page)).paused).toBe(false)
    // Шевельнули — вернулась.
    await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 3)
    await expect(row).toHaveClass(shown)
    // Ушли с ролика — прячется сразу.
    await page.mouse.move(b.x + b.width / 2, b.y + b.height + 150)
    await expect(row).not.toHaveClass(shown, { timeout: 1_000 })
  })

  test('над полосой — время точки; перемотка на паузе двигает счётчик', async ({ page }) => {
    await open(page)
    await start(page)
    const box = container(page)
    await box.click()
    await expect.poll(async () => (await state(page)).paused).toBe(true)
    const bar = box.getByRole('slider', { name: 'Перемотка' })
    const b = (await bar.boundingBox())!
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2)
    await expect(bar).toContainText('0:15')
    await page.mouse.move(b.x + b.width * 0.2, b.y + b.height / 2)
    await expect(bar).toContainText('0:06')

    // Стрелка на паузе: кадр и счётчик — на новом месте, хотя ролик стоит.
    const before = (await state(page)).time
    await box.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(before + 5, 0)
    const expected = Math.floor(before + 5)
    await expect(bar).toHaveAttribute('aria-valuenow', String(expected), { timeout: 3_000 })
  })

  test('субтитры с сервера — дорожка ролика со всеми репликами', async ({ page }) => {
    await open(page, { captions: [{ language: 'ru', label: 'Русский', vtt: VTT }] })
    const track = video(page).locator('track')
    await expect(track).toHaveCount(1, { timeout: 20_000 })
    await expect(track).toHaveAttribute('srclang', 'ru')
    await expect(track).toHaveAttribute('label', 'Русский')
    // VTT отдан плееру из памяти (blob:), а не ссылкой на чужой хост.
    await expect(track).toHaveAttribute('src', /^blob:/)
    await start(page)
    const cues = await video(page).evaluate(async (v: HTMLVideoElement) => {
      const t = v.textTracks[0]!
      t.mode = 'hidden'
      for (let i = 0; i < 50 && !(t.cues && t.cues.length); i++) {
        await new Promise((r) => setTimeout(r, 100))
      }
      return Array.from(t.cues ?? []).map((c) => (c as VTTCue).text)
    })
    expect(cues).toEqual(['Первая реплика', 'Вторая реплика'])
  })

  test('HLS: в меню качество ролика и «Авто»; выбор отмечается', async ({ page }) => {
    const peertube = await (async () => {
      await useMockNode(page, DATA)
      return useMockPeerTube(page, { hls: true })
    })()
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await start(page)
    expect(peertube.requests.hls).toBeGreaterThan(0)
    await container(page).hover()
    await container(page).getByRole('button', { name: 'Настройки' }).click()
    await page.getByRole('menuitem', { name: /Качество/ }).click()
    const p240 = page.getByRole('menuitemradio', { name: /240p/ })
    const auto = page.getByRole('menuitemradio', { name: /Авто/ })
    await expect(p240).toBeVisible()
    await expect(auto).toHaveAttribute('aria-checked', 'true')
    await p240.click()
    await container(page).hover()
    await container(page).getByRole('button', { name: 'Настройки' }).click()
    await page.getByRole('menuitem', { name: /Качество/ }).click()
    await expect(page.getByRole('menuitemradio', { name: /240p/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect((await state(page)).paused).toBe(false)
  })

  test('звук из ленты играет с волной вместо картинки', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'волна — WebGL и AudioContext')
    await open(
      page,
      { hls: true, audioOnly: true },
      {
        ...DATA,
        posts: [{ ...DATA.posts[0]!, type: 'audio', message: 'Трек для проверки' }],
      }
    )
    await start(page)
    const canvas = container(page).locator('canvas')
    await expect(canvas).toHaveCount(1, { timeout: 15_000 })
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > 0)).toBe(true)
    // Звук идёт через AudioContext, ролик не встал.
    await page.waitForTimeout(500)
    expect((await state(page)).paused).toBe(false)
  })

  test('клавиши: громкость, звук, скорость, кадр на паузе, справка, весь экран', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page)
    await start(page)
    const box = container(page)
    await box.hover()

    // ↓ / ↑ — громкость шагом 5 % с подсказкой на ролике.
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (await state(page)).volume).toBeCloseTo(0.95, 2)
    await expect(box.getByText('95%')).toBeVisible()
    await page.keyboard.press('ArrowUp')
    await expect.poll(async () => (await state(page)).volume).toBeCloseTo(1, 2)
    // m — звук выключен и обратно.
    await page.keyboard.press('KeyM')
    await expect.poll(async () => (await state(page)).volume).toBe(0)
    await page.keyboard.press('KeyM')
    await expect.poll(async () => (await state(page)).volume).toBe(1)

    // Shift+. / Shift+, — скорость.
    await page.keyboard.press('Shift+Period')
    await expect.poll(async () => (await state(page)).rate).toBe(1.25)
    await page.keyboard.press('Shift+Comma')
    await expect.poll(async () => (await state(page)).rate).toBe(1)

    // k — пауза; . и , на паузе — кадр вперёд и назад.
    await page.keyboard.press('KeyK')
    await expect.poll(async () => (await state(page)).paused).toBe(true)
    const at = (await state(page)).time
    await page.keyboard.press('Period')
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(at + 1 / 30, 2)
    await page.keyboard.press('Comma')
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(at, 2)

    // ? — справка по клавишам, ещё раз — закрыть.
    await page.keyboard.press('Shift+Slash')
    await expect(page.getByText('Горячие клавиши')).toBeVisible()
    await page.keyboard.press('Shift+Slash')
    await expect(page.getByText('Горячие клавиши')).toBeHidden()

    // f — весь экран и обратно.
    await page.keyboard.press('KeyF')
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
    await page.keyboard.press('KeyF')
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
  })
})

test.describe('Плеер пальцем', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  /**
   * Касание через CDP: у touchscreen Playwright нет удержания и свайпа.
   * Одна сессия на тест — отпускание должно прийти туда же, где нажатие.
   */
  async function touchscreen(page: Page) {
    const cdp = await page.context().newCDPSession(page)
    return (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      })
  }

  test('удержание — 2×, отпустил — прежняя скорость; двойное касание слева — назад', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'удержание пальца — через CDP')
    await open(page)
    await start(page, true)
    const b = (await container(page).boundingBox())!
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2

    const touch = await touchscreen(page)
    await touch('touchStart', x, y)
    await expect.poll(async () => (await state(page)).rate, { timeout: 3_000 }).toBe(2)
    await expect(container(page).getByText('2x')).toBeVisible()
    await touch('touchEnd')
    await expect.poll(async () => (await state(page)).rate).toBe(1)

    // Двойное касание слева — на 10 секунд назад.
    await page.evaluate(() => {
      const v = document.querySelector('video')!
      v.currentTime = 20
    })
    const left = b.x + b.width * 0.15
    await page.touchscreen.tap(left, y)
    await page.touchscreen.tap(left, y)
    await expect.poll(async () => (await state(page)).time).toBeLessThan(13)
    await expect(container(page).getByText(/10 секунд/)).toBeVisible()
  })

  test('во весь экран — свайп вниз выходит из него', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'свайп — через CDP')
    await open(page)
    await start(page, true)
    const b = (await container(page).boundingBox())!
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2 + 30)
    await container(page).getByRole('button', { name: 'Полноэкранный режим' }).tap()
    await expect(
      container(page).getByRole('button', { name: 'Выход из полноэкранного режима' })
    ).toBeAttached()

    const f = (await container(page).boundingBox())!
    const x = f.x + f.width / 2
    const y = f.y + f.height / 3
    const touch = await touchscreen(page)
    await touch('touchStart', x, y)
    await touch('touchMove', x, y + 60)
    await touch('touchMove', x, y + 160)
    await touch('touchEnd')
    await expect(
      container(page).getByRole('button', { name: 'Полноэкранный режим' })
    ).toBeAttached()
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
  })
})
