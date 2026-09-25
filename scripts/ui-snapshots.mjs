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

/** mobile: false — экран только для десктопа. */
const SCREENS = [
  { name: 'feed', path: '/' },
  { name: 'explorer', path: '/explorer' },
  { name: 'explorer-block', path: '/explorer/block/1', mobile: false },
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
  { name: 'settings-general', path: '/settings', auth: true, tab: 'Общие' },
  { name: 'settings-notifications', path: '/settings', auth: true, tab: 'Уведомления' },
  { name: 'settings-system', path: '/settings', auth: true, tab: 'Система', mobile: false },
  { name: 'settings-key', path: '/settings', auth: true, tab: 'Приватный ключ', mobile: false },
  { name: 'wallets', path: '/wallets', auth: true },
  { name: 'compose', path: '/compose', auth: true },
  { name: 'limits', path: '/limits', auth: true, mobile: false },
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
  await dismissPopups(page)
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
      (s) => (!ONLY || ONLY.has(s.name)) && !(isMobile && s.mobile === false)
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
