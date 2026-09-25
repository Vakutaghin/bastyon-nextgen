#!/usr/bin/env node
// Скриншоты ключевых экранов в обеих темах, на десктопе и мобилке — чтобы
// сравнивать «до» и «после» при редизайне (_docs-todo/REDESIGN_NUXT_UI.md).
// Ходит к живым нодам, как e2e, поэтому лента и эксплорер каждый раз разные:
// сравнивать оформление, а не содержимое.
//
//   pnpm dev                                        # порт 1980, в другом терминале
//   node scripts/ui-snapshots.mjs --out /tmp/ui-after
//   node scripts/ui-snapshots.mjs --out /tmp/ui-after --only feed,settings-general --theme dark
//
// «До» для сравнения — любой прежний коммит: git worktree add /tmp/ui-base <sha>,
// симлинк node_modules, pnpm dev там и этот же скрипт с --out /tmp/ui-before.
//
// Экраны с пометкой auth снимаются после входа свежей мнемоникой: аккаунт в сети
// не зарегистрирован, но настройки, кошелёк и редактор поста открываются.
// Мессенджер и уведомления у такого аккаунта пустые, поэтому для их снимков
// скрипт подкладывает тестовые диалоги и уведомления прямо в сторы Pinia — это
// проверка оформления, а не данных. Донат и жалоба открываются через свои сторы.
//
// Флаги: --out DIR (обязателен), --base URL (http://localhost:1980),
//        --only a,b,c, --theme dark|light|both, --viewport desktop|mobile|both.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import bip39 from 'bip39'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '')
  const next = process.argv[i + 1]
  args[key] = next && !next.startsWith('--') ? (i++, next) : 'true'
}

if (!args.out) {
  console.error('Укажи папку: --out /tmp/ui-after')
  process.exit(1)
}

const BASE = args.base || 'http://localhost:1980'
const OUT = args.out
const ONLY = args.only ? new Set(args.only.split(',')) : null
const THEMES = args.theme && args.theme !== 'both' ? [args.theme] : ['dark', 'light']
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}
const VIEWPORT_NAMES =
  args.viewport && args.viewport !== 'both' ? [args.viewport] : Object.keys(VIEWPORTS)

// Сеть живая: ждём, пока лента и графики дорисуются.
const SETTLE_MS = 6000

/** Перейти по первой ссылке, чей href содержит part (страницы эксплорера). */
async function followFirstLink(page, part) {
  const href = await page.locator(`a[href*="${part}"]`).first().getAttribute('href')
  await page.goto(BASE + href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(SETTLE_MS)
}

/** Выполнить fn в странице с доступом к сторам Pinia приложения. */
function withStores(page, fn, arg) {
  return page.evaluate(
    ({ body, arg }) => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
      const store = (id) => pinia._s.get(id)
      return new Function('store', 'arg', `(${body})(store, arg)`)(store, arg)
    },
    { body: fn.toString(), arg }
  )
}

/** Тестовые диалоги и сообщения всех видов, которые умеет рисовать чат. */
function mockMessenger(store, { openChat }) {
  const ui = store('messenger-ui')
  const chat = store('messenger-chat')
  const now = Date.now()
  const min = 60_000
  const msg = (id, chatId, senderId, text, ago, extra = {}) => ({
    id,
    chatId,
    senderId,
    text,
    type: 'text',
    timestamp: now - ago * min,
    read: true,
    status: 'read',
    ...extra,
  })
  const anna = '@anna:matrix.pocketnet.app'
  const messages = [
    msg('m1', '!demo1', anna, 'Привет! Видела пост про новое оформление — выглядит свежо.', 52),
    msg('m2', '!demo1', 'me', 'Спасибо! Палитра как у Nuxt UI и шрифт Geist.', 50),
    msg('m3', '!demo1', anna, 'А тёмная тема тоже поменялась?', 49, {
      reactions: [{ key: '👍', count: 1, my: true }],
    }),
    msg('m4', '!demo1', 'me', 'Да, обе. Переключатель — солнце и луна в шапке.', 47, {
      replyTo: { id: 'm3' },
    }),
    msg('m5', '!demo1', anna, '', 30, {
      type: 'transaction',
      info: {
        transaction: {
          txid: '9f3c1e7a5b2d4c6e8f0a1b3c5d7e9f1a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e',
          amount: 5,
          from: 'PAnnaAddress',
          to: 'PMyAddress',
          message: 'На кофе ☕',
        },
      },
    }),
    msg('m6', '!demo1', 'me', 'Ого, спасибо!', 20, { status: 'sent' }),
    msg('m7', '!demo1', 'me', 'А это сообщение не ушло', 2, { status: 'failed', read: false }),
  ]
  chat.messages['!demo1'] = messages
  ui.setDialogs([
    {
      id: '!demo1',
      partner: { id: anna, name: 'Анна' },
      unreadCount: 0,
      lastMessage: messages[5],
    },
    {
      id: '!demo2',
      partner: { id: '@boris:matrix.pocketnet.app', name: 'Борис Ковалёв', online: true },
      unreadCount: 3,
      lastMessage: msg('b1', '!demo2', '@boris', 'Скинешь ссылку на мини-приложение?', 5),
    },
    {
      id: '!demo3',
      partner: { id: '@club:matrix.pocketnet.app', name: 'PKOIN Club' },
      unreadCount: 0,
      lastMessage: msg('c1', '!demo3', '@club', 'Курс обновился, смотрите график', 180),
    },
  ])
  ui.dialogsLoadedOnce = true
  ui.isLoading = false
  ui.isMessagesLoading = false
  ui.isOpen = true
  if (openChat) ui.setActiveChatId('!demo1')
}

/** Уведомления всех типов — по одному на каждый вид плашки. */
function mockNotifications(store) {
  const s = store('notifications')
  const now = Math.floor(Date.now() / 1000)
  const from = (name) => ({ address: `P${name}Address`, name })
  const post = { txid: 'demo-post', caption: 'Новое оформление: палитра и шрифт как у Nuxt UI' }
  s.items = [
    {
      id: 'n1',
      nblock: 10,
      type: 'comment',
      mesType: 'comment',
      title: '',
      time: now - 90,
      seen: false,
      fromSnapshot: from('Анна'),
      commentSnapshot: { id: 'c1', message: 'Отличный разбор, спасибо! Тёмная тема особенно.' },
      postSnapshot: post,
    },
    {
      id: 'n2',
      nblock: 9,
      type: 'rating',
      mesType: 'upvoteShare',
      upvoteVal: 5,
      title: '',
      time: now - 600,
      seen: false,
      fromSnapshot: from('Борис'),
      postSnapshot: post,
    },
    {
      id: 'n3',
      nblock: 8,
      type: 'subscribe',
      mesType: 'subscribe',
      title: '',
      time: now - 3600,
      seen: true,
      fromSnapshot: from('Вера'),
    },
    {
      id: 'n4',
      nblock: 7,
      type: 'repost',
      mesType: 'reshare',
      title: '',
      time: now - 7200,
      seen: true,
      fromSnapshot: from('Глеб'),
      postSnapshot: post,
    },
    {
      id: 'n5',
      nblock: 6,
      type: 'tip',
      mesType: 'donate',
      title: '',
      time: now - 86400,
      seen: true,
      fromSnapshot: from('Дина'),
    },
    {
      id: 'n6',
      nblock: 5,
      type: 'mention',
      mesType: 'mention',
      title: '',
      time: now - 172800,
      seen: true,
      fromSnapshot: from('Егор'),
      commentSnapshot: { id: 'c2', message: '@me посмотри, как теперь выглядят уведомления' },
    },
  ]
  s.readBlock = 8
  s.inited = true
  s.loading = false
}

/** mobile: false — экран только для десктопа; desktop: false — только для мобилки;
 *  popups: true — не закрывать всплывающее само («Что нового»). */
const SCREENS = [
  { name: 'feed', path: '/' },
  { name: 'whats-new', path: '/', popups: true },
  {
    name: 'mobile-menu',
    path: '/',
    desktop: false,
    action: async (page) => {
      await page.getByRole('button', { name: 'Меню', exact: true }).click()
      await page.waitForTimeout(600)
    },
  },
  {
    // Окно поста открывает «Показать полностью» у длинного поста.
    name: 'post-modal',
    path: '/',
    action: async (page) => {
      const more = page.getByRole('button', { name: /Показать полностью|Читать статью/ }).first()
      for (let i = 0; i < 8 && !(await more.isVisible().catch(() => false)); i++) {
        await page.mouse.wheel(0, 900)
        await page.waitForTimeout(700)
      }
      await more.click()
      await page.waitForTimeout(3000)
    },
  },
  { name: 'explorer', path: '/explorer' },
  { name: 'explorer-block', path: '/explorer/block/1' },
  {
    name: 'explorer-tx',
    path: '/explorer/block/1',
    action: (page) => followFirstLink(page, '/explorer/tx/'),
  },
  {
    name: 'explorer-address',
    path: '/explorer/block/1',
    action: async (page) => {
      await followFirstLink(page, '/explorer/tx/')
      await followFirstLink(page, '/explorer/address/')
    },
  },
  { name: 'explorer-peers', path: '/explorer/peers' },
  { name: 'search', path: '/search?q=bastyon', mobile: false },
  { name: 'miniapps', path: '/miniapps' },
  {
    // Профиль — первого автора из ленты: своего у свежего аккаунта нет.
    name: 'profile',
    path: '/',
    action: async (page) => {
      await page.locator('a.author-link').first().click()
      await page.waitForTimeout(SETTLE_MS)
    },
  },
  {
    name: 'signin-modal',
    path: '/',
    action: async (page) => {
      await page.getByRole('button', { name: 'Войти', exact: true }).first().click()
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'register-modal',
    path: '/',
    action: async (page) => {
      await page.getByRole('button', { name: 'Регистрация', exact: true }).first().click()
      await page.waitForTimeout(800)
    },
  },
  { name: 'settings-general', path: '/settings', auth: true, tab: 'Общие' },
  { name: 'settings-notifications', path: '/settings', auth: true, tab: 'Уведомления' },
  { name: 'settings-system', path: '/settings', auth: true, tab: 'Система', mobile: false },
  { name: 'settings-key', path: '/settings', auth: true, tab: 'Приватный ключ', mobile: false },
  { name: 'wallets', path: '/wallets', auth: true },
  { name: 'wallet-transfers', path: '/wallets', auth: true, tab: 'Переводы' },
  { name: 'wallet-history', path: '/wallets', auth: true, tab: 'История' },
  { name: 'wallet-earnings', path: '/wallets', auth: true, tab: 'Заработок' },
  { name: 'wallet-buy', path: '/wallets', auth: true, tab: 'Покупка/продажа' },
  { name: 'compose', path: '/compose', auth: true },
  { name: 'limits', path: '/limits', auth: true, mobile: false },
  { name: 'my-videos', path: '/my-videos', auth: true },
  {
    name: 'notifications',
    path: '/',
    auth: true,
    action: async (page) => {
      await withStores(page, mockNotifications)
      await page.locator('header svg.lucide-bell').first().click()
      await page.waitForTimeout(800)
    },
  },
  {
    name: 'messenger-list',
    path: '/',
    auth: true,
    action: async (page) => {
      await withStores(page, mockMessenger, { openChat: false })
      await page.waitForTimeout(1200)
    },
  },
  {
    name: 'messenger-chat',
    path: '/',
    auth: true,
    action: async (page) => {
      await withStores(page, mockMessenger, { openChat: true })
      await page.waitForTimeout(1500)
    },
  },
  {
    name: 'donate-modal',
    path: '/',
    auth: true,
    action: async (page) => {
      await withStores(
        page,
        (store) => store('donate').open({ address: 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82', name: 'Анна' })
      )
      await page.waitForTimeout(800)
    },
  },
  {
    name: 'report-modal',
    path: '/',
    auth: true,
    action: async (page) => {
      await withStores(page, (store) =>
        store('report').open({
          contentHash: 'demo-post',
          authorAddress: 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82',
          type: 'post',
        })
      )
      await page.waitForTimeout(800)
    },
  },
  {
    name: 'user-menu',
    path: '/',
    auth: true,
    mobile: false,
    action: async (page) => {
      await page
        .locator('header')
        .getByText(/^P[1-9A-HJ-NP-Za-km-z]{6}/)
        .first()
        .click()
      await page.waitForTimeout(600)
    },
  },
]

/** Закрыть то, что всплывает само: «Что нового», напоминание о бэкапе. */
async function dismissPopups(page) {
  for (const name of ['Понятно', 'Позже']) {
    await page
      .getByRole('button', { name, exact: true })
      .first()
      .click({ timeout: 1200 })
      .catch(() => {})
  }
}

async function signIn(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page.waitForTimeout(1500)
  await dismissPopups(page)
  await page.getByRole('button', { name: 'Войти', exact: true }).first().click()
  await page.getByPlaceholder(/12-словную/).fill(bip39.generateMnemonic())
  await page.locator('.ant-modal').getByRole('button', { name: 'Войти', exact: true }).click()
  await page.waitForTimeout(6000)
  await dismissPopups(page)
}

async function shoot(page, screen, file) {
  await page.goto(BASE + screen.path, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page.waitForTimeout(SETTLE_MS)
  if (!screen.popups) await dismissPopups(page)
  if (screen.tab) {
    await page.getByText(screen.tab, { exact: true }).first().click()
    await page.waitForTimeout(800)
  }
  if (screen.action) await screen.action(page)
  await page.screenshot({ path: file })
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
let failed = 0

for (const vpName of VIEWPORT_NAMES) {
  for (const theme of THEMES) {
    const isMobile = vpName === 'mobile'
    const screens = SCREENS.filter(
      (s) =>
        (!ONLY || ONLY.has(s.name)) &&
        !(isMobile && s.mobile === false) &&
        !(!isMobile && s.desktop === false)
    )
    // Сначала публичные экраны, потом вход и экраны под аккаунтом.
    const ordered = [...screens.filter((s) => !s.auth), ...screens.filter((s) => s.auth)]
    if (!ordered.length) continue

    const context = await browser.newContext({
      viewport: VIEWPORTS[vpName],
      locale: 'ru-RU',
      colorScheme: theme,
      isMobile,
      hasTouch: isMobile,
    })
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('bastyon_theme', t)
      } catch {
        /* нет storage — останется системная тема */
      }
    }, theme)
    const page = await context.newPage()
    let signedIn = false

    for (const screen of ordered) {
      const file = join(OUT, `${screen.name}-${vpName}-${theme}.png`)
      try {
        if (screen.auth && !signedIn) {
          await signIn(page)
          signedIn = true
        }
        await shoot(page, screen, file)
        console.log('ok  ', file)
      } catch (e) {
        failed++
        console.log('FAIL', file, String(e).split('\n')[0])
      }
    }
    await context.close()
  }
}

await browser.close()
process.exit(failed ? 1 : 0)
