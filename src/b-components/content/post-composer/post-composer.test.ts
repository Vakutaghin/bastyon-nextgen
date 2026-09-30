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
  editor: { config: null as Record<string, unknown> | null, readOnly: [] as boolean[] },
}))

const idb = vi.hoisted(() => new Map<string, unknown>())
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
  PENDING_POST_TTL_MS: 60_000,
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
// Editor.js в happy-dom не работает — подменный запоминает, что ему велели.
vi.mock('@editorjs/editorjs', () => ({
  default: class {
    isReady = Promise.resolve()
    readOnly = {
      toggle: async (state = false) => {
        mocks.editor.readOnly.push(state)
        return state
      },
    }
    constructor(config: Record<string, unknown>) {
      mocks.editor.config = config
    }
    save = async () => ({ blocks: [] })
    destroy = () => {}
  },
}))
vi.mock('@editorjs/header', () => ({ default: class {} }))
vi.mock('@editorjs/list', () => ({ default: class {} }))
vi.mock('@editorjs/quote', () => ({ default: class {} }))
vi.mock('@editorjs/code', () => ({ default: class {} }))
vi.mock('@editorjs/image', () => ({ default: class {} }))
vi.mock('@editorjs/delimiter', () => ({ default: class {} }))

import LinkPreviewCard from '@/b-components/content/link-preview-card/link-preview-card.vue'
import VoiceInputButton from '@/b-components/voice-input/voice-input-button.vue'
import ComposerArticleEditor from './composer-article-editor.vue'
import PostComposer from './post-composer.vue'
import { type PostDraftFields, writeDraft, writeDraftFields, writeDraftImages } from './post-draft'

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

// Черновик читается после монтирования, календарь и Editor.js — отдельными чанками.
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

/** Всё, чем меняют пост; у antd-списков и календаря это их внутренние поля. */
function controls(w: VueWrapper): HTMLInputElement[] {
  return w.findAll('input, textarea, button, select').map((c) => c.element as HTMLInputElement)
}

const describeControl = (el: Element): string => el.outerHTML.slice(0, 90)

function expectLocked(w: VueWrapper): void {
  const list = controls(w)
  expect(list.length).toBeGreaterThan(5)
  expect(list.filter((el) => !el.disabled).map(describeControl)).toEqual([])
  expect(w.findAll('.ant-select').every((s) => s.classes('ant-select-disabled'))).toBe(true)
  expect(w.find('.ant-picker').classes()).toContain('ant-picker-disabled')
}

function expectUnlocked(w: VueWrapper): void {
  expect(
    controls(w)
      .filter((el) => el.disabled)
      .map(describeControl)
  ).toEqual([])
  expect(w.findAll('.ant-select-disabled')).toHaveLength(0)
  expect(w.find('.ant-picker').classes()).not.toContain('ant-picker-disabled')
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
  mocks.editor.config = null
  mocks.editor.readOnly = []
})

describe('окно поста во время публикации', () => {
  it('заблокировано всё; публикация не удалась — форма снова доступна и цела', async () => {
    await seedDraft({}, [PNG])
    const sending = holdSending()
    const w = await render()

    // Черновик поднялся целиком: картинка, тег, опрос, ссылка.
    expect(w.findAll('img[src^="data:image/png"]')).toHaveLength(1)
    expect(w.text()).toContain('#море')
    expect(w.findAll('input[type="file"]')).toHaveLength(1)
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

  it('статья: Editor.js на время публикации только для чтения', async () => {
    await seedDraft({
      caption: 'Как мы ездили на море',
      poll: { active: false, title: '', options: ['', ''] },
      articleMode: true,
      articleContent: { blocks: [{ type: 'paragraph', data: { text: 'Вода была тёплой.' } }] },
    })
    const sending = holdSending()
    const w = await render()
    expect(mocks.editor.config?.readOnly).toBe(false)

    await publish(w)
    expectLocked(w)
    expect(mocks.editor.readOnly).toEqual([true])
    expect(w.findComponent(ComposerArticleEditor).classes()).toContain('disabled')

    sending.fail(new Error(FAILURE))
    await settle()
    expectUnlocked(w)
    expect(mocks.editor.readOnly).toEqual([true, false])
    w.unmount()
  })
})
