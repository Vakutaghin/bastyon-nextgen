import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Окно поста: «Пост / Статья» вверху, текст без рамки, панель вложений и
 * сводка настроек «Все · Русский · Сразу». Статья — редактор без панелей:
 * Markdown на ходу, «/» открывает меню блоков, выделение — панель над ним.
 * Статья хранится блоками Editor.js: переключение туда-обратно проводит её
 * через блоки, и ничего не теряется.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = { profiles: [ALICE], posts: [], comments: [] }

async function openComposer(page: Page) {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const signIn = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await signIn.locator('input, textarea').first().fill(MNEMONIC)
  await signIn.getByRole('button', { name: 'Войти' }).click()
  await expect(signIn).toBeHidden({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await expect(composer).toBeVisible()
  return composer
}

test('пост: панель вложений, опрос кнопкой, настройки в сводке', async ({ page }) => {
  test.setTimeout(90_000)
  const composer = await openComposer(page)

  await expect(composer.getByRole('button', { name: 'Пост', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  for (const name of ['Добавить изображения', 'Загрузить видео или аудио', 'Опрос', 'Эмодзи']) {
    await expect(composer.getByRole('button', { name, exact: true })).toBeVisible()
  }

  await composer.getByRole('button', { name: 'Опрос', exact: true }).click()
  await expect(composer.getByRole('textbox', { name: 'Вопрос опроса' })).toBeVisible()
  await composer.getByRole('button', { name: 'Убрать опрос' }).click()
  await expect(composer.getByRole('textbox', { name: 'Вопрос опроса' })).toHaveCount(0)

  const settings = composer.getByRole('button', { name: /^Настройки публикации/ })
  await expect(settings).toContainText('Все · Русский · Сразу')
  await expect(composer.getByText('Видимость', { exact: true })).toHaveCount(0)
  await settings.click()
  await expect(composer.getByText('Видимость', { exact: true })).toBeVisible()
  await expect(composer.getByText('Отложить публикацию', { exact: true })).toBeVisible()
})

test('статья: Markdown, меню «/», панель над выделением; переключение ничего не теряет', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const composer = await openComposer(page)
  await composer.getByRole('button', { name: 'Статья', exact: true }).click()
  await composer.getByRole('textbox', { name: 'Заголовок статьи' }).fill('Как мы ездили на море')

  const editor = composer.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('## Дорога')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Выехали рано утром, к обеду были на месте.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('> Море было тёплым')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  // «/» в пустой строке — меню блоков; Escape закрывает его, но не окно поста.
  await page.keyboard.type('/')
  const blocks = page.getByRole('menu', { name: 'Добавить блок' })
  await expect(blocks).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(blocks).toBeHidden()
  await expect(composer).toBeVisible()
  await page.keyboard.press('Backspace')
  await page.keyboard.type('/')
  await blocks.getByRole('menuitem', { name: 'Разделитель' }).click()

  await expect(editor.locator('h2')).toHaveText('Дорога')
  await expect(editor.locator('blockquote')).toContainText('Море было тёплым')
  await expect(editor.locator('hr')).toHaveCount(1)
  await expect(editor).not.toContainText('/')

  // Выделили слово — панель над ним; «Жирный» оформляет его.
  await editor.getByText('Выехали рано утром').dblclick()
  const toolbar = page.getByRole('toolbar', { name: 'Оформление текста' })
  await expect(toolbar).toBeVisible()
  await toolbar.getByRole('button', { name: 'Жирный' }).click()
  await expect(editor.locator('strong')).toHaveCount(1)

  // Пост и снова статья: статья прошла через блоки Editor.js и вернулась целой.
  await composer.getByRole('button', { name: 'Пост', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await composer.getByRole('button', { name: 'Статья', exact: true }).click()
  await expect(editor.locator('h2')).toHaveText('Дорога')
  await expect(editor.locator('blockquote')).toContainText('Море было тёплым')
  await expect(editor.locator('hr')).toHaveCount(1)
  await expect(editor.locator('strong')).toHaveCount(1)
  await expect(composer.getByRole('textbox', { name: 'Заголовок статьи' })).toHaveValue(
    'Как мы ездили на море'
  )
})
