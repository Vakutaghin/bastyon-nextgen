// Окно поста, пока пост публикуется: заблокировано всё, чем пост меняют, —
// поля, флажки, кнопки, выпадающие списки, редактор статьи, голосовой ввод,
// крестик карточки ссылки. Иначе правка на полпути попадала в пост лишь
// частично, а после публикации всё равно стиралась. Не удалось — форма снова
// доступна и ничего не потеряла. Композер и его части настоящие; нода,
// отправка, загрузка картинок и сторы подменены, черновик — в памяти.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    isUserAuthenticated: boolean
    getUserAddress: string | null
    getUserState: { trial?: boolean } | null
    getKeyPair: { privateKey: string } | null
  },
  sendPost: vi.fn(),
  uploadImages: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  closeMentions: vi.fn(),
  /** Подменный Editor.js: настройки при создании и переключения «только чтение». */
}))

const idb = vi.hoisted(() => new Map<string, unknown>())
// Монеты на комиссию заранее — без сети.
vi.mock('@/blockchain/core/transactions/unspents-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/blockchain/core/transactions/unspents-manager')>()),
  prefetchFeeUnspents: vi.fn(),
}))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: async (key: string) => idb.get(key),
    set: async (key: string, value: unknown) => {
      idb.set(key, value)
      return key
    },
    remove: async (key: string) => {
      idb.delete(key)
    },
  },
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores', () => ({
  useModalStore: () => ({ openAuthModal: vi.fn() }),
  usePendingPostsStore: () => ({ addPending: vi.fn() }),
  pendingPostDeadline: (createdAt: number, scheduledAt?: number) =>
    Math.max(createdAt, scheduledAt ?? 0) + 60_000,
}))
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: mocks.toastError, success: mocks.toastSuccess },
}))
vi.mock('@/helpers/api/account-settings', () => ({
  fetchAccountSettings: vi.fn().mockResolvedValue({}),
  paidSubscriptionPrice: () => 0,
  paidSubscriptionValue: () => 0,
}))
vi.mock('@/helpers/common/haptics', () => ({ haptic: vi.fn() }))
vi.mock('@/services/image-upload-service', () => ({
  uploadImages: mocks.uploadImages,
  uploadImage: vi.fn(),
}))
vi.mock('./post-sender', () => ({ sendPost: mocks.sendPost }))
// Подсказки тегов и @-имён спрашивают ноду; здесь от них нужно только закрытие.
vi.mock('@/composables/use-rpc-query', async () => {
  const { ref } = await import('vue')
  return { useRpcQuery: () => ({ data: ref(null) }) }
})
vi.mock('./use-composer-mentions', async () => {
  const { ref } = await import('vue')
  return {
    useComposerMentions: () => ({
      show: ref(false),
      results: ref([]),
      searching: ref(false),
      highlight: ref(0),
      update: vi.fn(),
      close: mocks.closeMentions,
      select: vi.fn(),
      onKeydown: vi.fn(),
    }),
  }
})

import LinkPreviewCard from '@/b-components/content/link-preview-card/link-preview-card.vue'
import VoiceInputButton from '@/b-components/voice-input/voice-input-button.vue'
import ComposerArticleEditor from './composer-article-editor.vue'
import PostComposer from './post-composer.vue'
import { type PostDraftFields, writeDraft, writeDraftFields, writeDraftImages } from './post-draft'
import { UI } from '@/components/testing/ui-selectors'

const ME = 'PMe'
const TEXT = 'Вчера съездили на море, вода тёплая. Фото и заметки: https://example.org/sea'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const FAILURE = 'Дневной лимит постов исчерпан'

/** Черновик с картинкой, тегом, опросом и ссылкой: видно почти все части окна. */
const FIELDS: PostDraftFields = {
  caption: '',
  tags: ['море'],
  visibility: '0',
  language: 'ru',
  poll: { active: true, title: 'Куда едем?', options: ['Море', 'Горы', 'Лес'] },
  scheduledTime: 0,
  articleMode: false,
  articleContent: null,
  videoUrl: '',
  audios: [],
  dismissedLinkUrl: '',
}

async function seedDraft(fields: Partial<PostDraftFields>, images: string[] = []) {
  writeDraft(ME, TEXT)
  await writeDraftFields(ME, { ...FIELDS, ...fields })
  await writeDraftImages(ME, images)
}

/** Отправка, которую тест завершает сам: публикация идёт, пока он не решит. */
function holdSending() {
  let fail: (e: Error) => void = () => {}
  mocks.sendPost.mockImplementation(() => new Promise<string>((_, reject) => (fail = reject)))
  return { fail: (e: Error) => fail(e) }
}

// Черновик читается после монтирования, календарь и редактор статьи — отдельными чанками.
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await vi.dynamicImportSettled()
  }
}

async function render(): Promise<VueWrapper> {
  const w = mount(PostComposer, {
    global: {
      plugins: [i18n],
      provide: { theme: {} },
      // Голосовой ввод есть только в приложении для компьютера, карточка ссылки
      // спрашивает ноду: от них здесь нужно только то, что им передали.
      stubs: { VoiceInputButton: true, LinkPreviewCard: true },
    },
  })
  await settle()
  return w
}

/** Настройки публикации свёрнуты в сводку «Все · Русский · Сразу» — раскрыть. */
async function openSettings(w: VueWrapper): Promise<void> {
  const chip = w.find('button[aria-label^="Настройки публикации"]')
  expect(chip.text()).toContain('Все · Русский · Сразу')
  await chip.trigger('click')
  await settle()
}

/** Всё, чем меняют пост: поля и кнопки окна; «?» справки пост не меняет — его не считаем. */
function controls(w: VueWrapper): HTMLInputElement[] {
  return w
    .findAll('input, textarea, button, select')
    .map((c) => c.element as HTMLInputElement)
    .filter((el) => !el.hasAttribute('data-help-link'))
}

const describeControl = (el: Element): string => el.outerHTML.slice(0, 90)

function expectLocked(w: VueWrapper): void {
  const list = controls(w)
  expect(list.length).toBeGreaterThan(5)
  expect(list.filter((el) => !el.disabled).map(describeControl)).toEqual([])
  expect(w.findAll(UI.select).every((s) => s.element.matches(UI.selectDisabled))).toBe(true)
  expect(w.find(UI.datePicker).element.matches(UI.datePickerDisabled)).toBe(true)
}

function expectUnlocked(w: VueWrapper): void {
  expect(
    controls(w)
      .filter((el) => el.disabled)
      .map(describeControl)
  ).toEqual([])
  expect(w.findAll(UI.selectDisabled)).toHaveLength(0)
  expect(w.find(UI.datePicker).element.matches(UI.datePickerDisabled)).toBe(false)
}

async function publish(w: VueWrapper): Promise<void> {
  const button = w.findAll('button').find((b) => b.text() === 'Опубликовать')
  expect(button).toBeDefined()
  await button!.trigger('click')
  await settle()
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  localStorage.clear()
  idb.clear()
  setActivePinia(createPinia())
  mocks.auth = reactive({
    isUserAuthenticated: true,
    getUserAddress: ME,
    getUserState: { trial: false },
    getKeyPair: { privateKey: 'priv' },
  })
  mocks.sendPost.mockReset()
  mocks.uploadImages
    .mockReset()
    .mockImplementation(async (list: string[]) => list.map((_, i) => `https://img/${i}.jpg`))
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.closeMentions.mockReset()
})

describe('окно поста во время публикации', () => {
  it('заблокировано всё; публикация не удалась — форма снова доступна и цела', async () => {
    await seedDraft({}, [PNG])
    const sending = holdSending()
    const w = await render()

    // Черновик поднялся целиком: картинка, тег, опрос, ссылка.
    expect(w.findAll('img[src^="data:image/png"]')).toHaveLength(1)
    expect(w.text()).toContain('#море')
    // Картинки — кнопкой панели и «+» в сетке; видео при картинках не предлагается.
    expect(w.findAll('input[type="file"]')).toHaveLength(2)
    expect(w.find('button[aria-label="Загрузить видео или аудио"]').exists()).toBe(false)
    await openSettings(w)
    expectUnlocked(w)

    await publish(w)
    expect(mocks.sendPost).toHaveBeenCalledTimes(1)
    expectLocked(w)
    expect(w.find('label.disabled input[type="file"]').exists()).toBe(true)
    expect(w.findComponent(VoiceInputButton).props('disabled')).toBe(true)
    expect(w.findComponent(LinkPreviewCard).props('disabled')).toBe(true)
    expect(mocks.closeMentions).toHaveBeenCalled()

    sending.fail(new Error(FAILURE))
    await settle()
    expect(mocks.toastError).toHaveBeenCalledWith({ message: FAILURE })
    expectUnlocked(w)
    expect(w.findComponent(VoiceInputButton).props('disabled')).toBe(false)
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe(TEXT)
    expect(w.findAll('img[src^="data:image/png"]')).toHaveLength(1)
    expect(w.text()).toContain('#море')
    w.unmount()
  })

  it('своё видео из черновика: панель «прикреплено», «Убрать» и заголовок блокируются', async () => {
    await seedDraft({
      caption: 'Закат над морем',
      poll: { active: false, title: '', options: ['', ''] },
      videoUrl: 'peertube://peertube101.pocketnet.app/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b',
    })
    const sending = holdSending()
    const w = await render()
    await openSettings(w)

    // Черновик читается после открытия окна; панель раньше так и оставалась
    // с выбором файла, хотя видео уже было в посте.
    expect(w.text()).toContain('Видео PeerTube прикреплено')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    const removeVideo = w.findAll('button').find((b) => b.text() === 'Убрать')
    expect(removeVideo).toBeDefined()
    expect((w.find('input[aria-label="Заголовок видео"]').element as HTMLInputElement).value).toBe(
      'Закат над морем'
    )

    await publish(w)
    expectLocked(w)
    expect(removeVideo!.attributes('disabled')).toBeDefined()

    sending.fail(new Error(FAILURE))
    await settle()
    expectUnlocked(w)
    w.unmount()
  })

  it('записи аудиокниги: список, названия и кнопки блокируются вместе с окном', async () => {
    await seedDraft({
      caption: 'Книга',
      poll: { active: false, title: '', options: ['', ''] },
      audios: [
        { url: 'peertube://pt.example/u1/audio', title: 'Глава 1', duration: 65 },
        { url: 'peertube://pt.example/u2/audio', title: 'Глава 2', duration: null },
      ],
    })
    const sending = holdSending()
    const w = await render()
    await openSettings(w)
    const rows = w.findAll('[data-testid="composer-audio"]')
    expect(rows).toHaveLength(2)
    expect((rows[0]!.find('input').element as HTMLInputElement).value).toBe('Глава 1')
    expect(rows[0]!.text()).toContain('1:05')
    // Предупреждение — одной строкой и только когда записей несколько.
    expect(w.find('[data-testid="composer-audios-hint"]').text()).toBe(
      'В прежнем Bastyon слышна только первая запись.'
    )
    // Ни картинок, ни видео рядом со звуком.
    expect(w.find('button[aria-label="Загрузить видео или аудио"]').exists()).toBe(false)
    expect(w.find('button[aria-label="Добавить изображения"]').exists()).toBe(false)

    await publish(w)
    expectLocked(w)
    sending.fail(new Error(FAILURE))
    await settle()
    expectUnlocked(w)

    await w.find('button[aria-label="Убрать запись «Глава 2»"]').trigger('click')
    expect(w.findAll('[data-testid="composer-audio"]')).toHaveLength(1)
    expect(w.find('[data-testid="composer-audios-hint"]').exists()).toBe(false)
    w.unmount()
  })

  it('кнопка серая — причина видна и без текста; набранный тег без Enter её снимает', async () => {
    // Ролик с заголовком, без текста и тегов: раньше кнопка молчала.
    await writeDraftFields(ME, {
      ...FIELDS,
      tags: [],
      caption: 'Закат над морем',
      poll: { active: false, title: '', options: ['', ''] },
      videoUrl: 'peertube://peertube101.pocketnet.app/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b',
    })
    const w = await render()
    const publishButton = () => w.findAll('button').find((b) => b.text() === 'Опубликовать')!
    expect(w.text()).toContain('Добавьте хотя бы один тег')
    expect(publishButton().attributes('disabled')).toBeDefined()

    await w.find('input[aria-label="Добавьте теги…"]').setValue('закат')
    expect(w.text()).not.toContain('Добавьте хотя бы один тег')
    expect(publishButton().attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('статья: редактор на время публикации только для чтения', async () => {
    await seedDraft({
      caption: 'Как мы ездили на море',
      poll: { active: false, title: '', options: ['', ''] },
      articleMode: true,
      articleContent: { blocks: [{ type: 'paragraph', data: { text: 'Вода была тёплой.' } }] },
    })
    const sending = holdSending()
    const w = await render()
    await openSettings(w)
    const editable = () => w.find('.ProseMirror').attributes('contenteditable')
    expect(w.find('.ProseMirror').text()).toContain('Вода была тёплой.')
    expect(editable()).toBe('true')

    await publish(w)
    expectLocked(w)
    expect(editable()).toBe('false')
    expect(w.findComponent(ComposerArticleEditor).classes()).toContain('disabled')

    sending.fail(new Error(FAILURE))
    await settle()
    expectUnlocked(w)
    expect(editable()).toBe('true')
    w.unmount()
  })
})

describe('теги в окне поста', () => {
  const chips = (w: VueWrapper): string[] =>
    w
      .findAll('button[aria-label^="Удалить тег "]')
      .map((b) => b.attributes('aria-label')!.replace('Удалить тег ', ''))

  const tagField = (w: VueWrapper) => w.find('input[aria-label="Добавьте теги…"]')

  /** Ввод в поле: значение и курсор в конце, как после клавиатуры или вставки. */
  async function setText(w: VueWrapper, value: string): Promise<void> {
    await w.find('textarea').setValue(value)
  }

  it('список тегов вставлен в текст — все встали в поле, подчёркивание на месте', async () => {
    const w = await render()
    await setText(w, 'О крипте\n\n#крипта_пкоин #Blockchain #новости_дня')
    expect(chips(w)).toEqual(['крипта_пкоин', 'blockchain', 'новости_дня'])
    expect(w.text()).toContain('3/15')
    w.unmount()
  })

  it('хэштег набирают по букве — тег один и целиком; ушли из поля — последний тоже', async () => {
    const w = await render()
    let text = ''
    for (const char of 'Я на #море и #горы') {
      text += char
      await setText(w, text)
    }
    expect(chips(w)).toEqual(['море'])
    await w.find('textarea').trigger('blur')
    expect(chips(w)).toEqual(['море', 'горы'])
    w.unmount()
  })

  it('хэштег под курсором — уже тег для «Опубликовать» и уходит с постом', async () => {
    mocks.sendPost.mockResolvedValue('tx1')
    const w = await render()
    let text = ''
    for (const char of 'Я на #море') {
      text += char
      await setText(w, text)
    }
    const button = w.findAll('button').find((b) => b.text() === 'Опубликовать')!
    expect(button.attributes('disabled')).toBeUndefined()
    await publish(w)
    expect(mocks.sendPost.mock.calls[0]![0].tags).toEqual(['море'])
    w.unmount()
  })

  it('убранный крестиком тег из текста не возвращается', async () => {
    const w = await render()
    await setText(w, 'Отпуск #море #горы ')
    await w.find('button[aria-label="Удалить тег море"]').trigger('click')
    await setText(w, 'Отпуск #море #горы и ещё')
    await w.find('textarea').trigger('blur')
    expect(chips(w)).toEqual(['горы'])
    w.unmount()
  })

  it('список вставлен в поле тегов: строки, запятые, решётки — всё сразу тегами', async () => {
    const w = await render()
    await tagField(w).setValue('моя_')
    const input = tagField(w).element as HTMLInputElement
    input.setSelectionRange(4, 4)
    await tagField(w).trigger('paste', {
      clipboardData: { getData: () => 'крипта\n#крипта_пкоин, новости\r\nлес' },
    })
    expect(chips(w)).toEqual(['моя_крипта', 'крипта_пкоин', 'новости', 'лес'])
    expect(input.value).toBe('')
    w.unmount()
  })

  it('одно слово вставляется в поле как обычно', async () => {
    const w = await render()
    const event = new Event('paste', { cancelable: true })
    Object.assign(event, { clipboardData: { getData: () => ' #крипта_пкоин ' } })
    tagField(w).element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    await tagField(w).setValue('#крипта_пкоин')
    await tagField(w).trigger('keydown', { key: 'Enter' })
    expect(chips(w)).toEqual(['крипта_пкоин'])
    w.unmount()
  })

  it('пятнадцать тегов, шестнадцатый не встаёт', async () => {
    const w = await render()
    await setText(w, Array.from({ length: 16 }, (_, i) => `#t${i}`).join(' ') + ' ')
    expect(chips(w)).toHaveLength(15)
    expect(w.text()).toContain('15/15')
    expect(tagField(w).attributes('disabled')).toBeDefined()
    w.unmount()
  })
})
