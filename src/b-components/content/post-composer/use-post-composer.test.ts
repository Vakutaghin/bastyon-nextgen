// Композер поста целиком: черновик в режиме создания, префилл при правке
// (видимость, язык и ссылка оригинала не теряются — V36), репост, триал
// только публичный, «платным подписчикам» — только при цене подписки,
// опрос (при правке — опубликованный как есть), ссылка и видео в `u`,
// и сама публикация: вход → проверка → картинки → sendPost → pending-пост →
// сброс → обновление ленты. Валидация, теги, опрос и разбор ссылок —
// настоящие модули; сеть, сторы и загрузка картинок подменены.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    isUserAuthenticated: boolean
    getUserAddress: string | null
    getUserState: { trial?: boolean } | null
    getKeyPair: { privateKey: string } | null
  },
  images: null as unknown as { value: string[] },
  setFromUrls: vi.fn(),
  clearImages: vi.fn(),
  sendPost: vi.fn(),
  uploadImages: vi.fn(),
  fetchAccountSettings: vi.fn(),
  paidSubscriptionPrice: vi.fn(),
  openAuthModal: vi.fn(),
  addPending: vi.fn(),
  invalidateQueries: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  haptic: vi.fn(),
}))

vi.mock('vue-i18n', async () => {
  const { ref: vueRef } = await import('vue')
  return { useI18n: () => ({ locale: vueRef('ru') }) }
})
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: mocks.toastError, success: mocks.toastSuccess },
}))
vi.mock('@/helpers/api/account-settings', () => ({
  fetchAccountSettings: mocks.fetchAccountSettings,
  paidSubscriptionPrice: mocks.paidSubscriptionPrice,
}))
vi.mock('@/helpers/common/haptics', () => ({ haptic: mocks.haptic }))
vi.mock('@/services/image-upload-service', () => ({ uploadImages: mocks.uploadImages }))
vi.mock('@/stores', () => ({
  useModalStore: () => ({ openAuthModal: mocks.openAuthModal }),
  usePendingPostsStore: () => ({ addPending: mocks.addPending }),
  PENDING_POST_TTL_MS: 60_000,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('./post-sender', () => ({ sendPost: mocks.sendPost }))
// Картинки: сжатие и canvas здесь ни при чём — только base64-список.
vi.mock('./use-post-images', async () => {
  const { ref: vueRef, computed: vueComputed } = await import('vue')
  return {
    usePostImages: () => {
      const list = vueRef<string[]>([])
      mocks.images = list
      return {
        images: list,
        full: vueComputed(() => false),
        base64List: vueComputed(() => list.value),
        addFiles: vi.fn(),
        remove: vi.fn(),
        rotate: vi.fn(),
        replace: vi.fn(),
        clear: () => {
          mocks.clearImages()
          list.value = []
        },
        setFromUrls: mocks.setFromUrls,
      }
    },
  }
})

import { postDraftKey } from './post-draft'
import { usePostComposer, type UsePostComposerOptions } from './use-post-composer'

const ME = 'PMe'
const TEXT = 'Вчера съездили на море, вода тёплая'

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function compose(options: UsePostComposerOptions = {}) {
  return usePostComposer(options)
}

function fillValidPost(c: ReturnType<typeof usePostComposer>, text = TEXT) {
  c.onMessageInput(text)
  c.addTag('море')
}

describe('usePostComposer', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.auth = reactive({
      isUserAuthenticated: true,
      getUserAddress: ME,
      getUserState: { trial: false },
      getKeyPair: { privateKey: 'priv' },
    })
    mocks.setFromUrls.mockReset()
    mocks.clearImages.mockReset()
    mocks.sendPost.mockReset().mockResolvedValue('tx-new')
    mocks.uploadImages
      .mockReset()
      .mockImplementation(async (list: string[]) => list.map((_, i) => `https://img/${i}.jpg`))
    mocks.fetchAccountSettings.mockReset().mockResolvedValue({})
    mocks.paidSubscriptionPrice.mockReset().mockReturnValue(0)
    mocks.openAuthModal.mockReset()
    mocks.addPending.mockReset()
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined)
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.haptic.mockReset()
  })

  describe('черновик', () => {
    it('текст сохраняется для своего аккаунта и поднимается при следующем открытии', () => {
      compose().onMessageInput('недописанный пост')
      expect(localStorage.getItem(postDraftKey(ME))).toBe('недописанный пост')
      expect(compose().message.value).toBe('недописанный пост')

      mocks.auth.getUserAddress = 'POther'
      expect(compose().message.value).toBe('')
    })

    it('правка и репост черновик не трогают', () => {
      compose().onMessageInput('мой черновик')
      const edit = compose({ mode: 'edit', source: { txid: 'tx1', message: 'старый текст' } })
      edit.onMessageInput('исправленный текст')
      const repost = compose({ mode: 'repost', source: { txid: 'tx2', message: 'чужой пост' } })
      expect(repost.message.value).toBe('')
      expect(localStorage.getItem(postDraftKey(ME))).toBe('мой черновик')
    })
  })

  describe('режимы', () => {
    it('создание: язык интерфейса, публичный пост, кнопка «Опубликовать»', () => {
      const c = compose()
      expect(c.language.value).toBe('ru')
      expect(c.visibility.value).toBe('0')
      expect(c.publishLabel.value).toBe('postComposer.publish')
    })

    it('правка: текст, заголовок, теги, картинки, видимость, язык и ссылка оригинала (V36)', () => {
      const c = compose({
        mode: 'edit',
        source: {
          txid: 'tx-old',
          message: 'Текст поста',
          caption: 'Заголовок',
          tags: ['a', 'b'],
          images: ['https://img/old.jpg'],
          url: 'peertube://host/uuid',
          language: 'en',
          settings: { f: '1' },
        },
      })
      expect(c.message.value).toBe('Текст поста')
      expect(c.caption.value).toBe('Заголовок')
      expect(c.tags.value).toEqual(['a', 'b'])
      expect(mocks.setFromUrls).toHaveBeenCalledWith(['https://img/old.jpg'])
      expect(c.visibility.value).toBe('1')
      expect(c.language.value).toBe('en')
      expect(c.uploadedVideoUrl.value).toBe('peertube://host/uuid')
      expect(c.hasUploadedVideo.value).toBe(false)
      expect(c.publishLabel.value).toBe('postComposer.save')
    })

    it('репост: пустой текст, ссылка на оригинал, кнопка «Репостнуть»', () => {
      const source = { txid: 'tx-orig', message: 'оригинал' }
      const c = compose({ mode: 'repost', source })
      expect(c.message.value).toBe('')
      expect(c.repostSource).toBe(source)
      expect(c.publishLabel.value).toBe('postComposer.repostPublish')
    })
  })

  describe('видимость', () => {
    it('триал-аккаунт публикует только для всех, что бы ни выбрал', async () => {
      mocks.auth.getUserState = { trial: true }
      const c = compose()
      fillValidPost(c)
      c.visibility.value = '1'
      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].settings.f).toBe('0')
      expect(c.isTrial.value).toBe(true)
    })

    it('«Платным подписчикам» доступно только при назначенной цене подписки', async () => {
      mocks.paidSubscriptionPrice.mockReturnValue(5)
      const c = compose()
      await flush()
      expect(mocks.fetchAccountSettings).toHaveBeenCalledWith(ME)
      expect(c.paidVisibilityAvailable.value).toBe(true)

      mocks.paidSubscriptionPrice.mockReturnValue(0)
      const free = compose()
      await flush()
      expect(free.paidVisibilityAvailable.value).toBe(false)

      mocks.fetchAccountSettings.mockRejectedValue(new Error('offline'))
      const offline = compose()
      await flush()
      expect(offline.paidVisibilityAvailable.value).toBe(false)
    })
  })

  describe('публикация', () => {
    it('гостя просит войти и ничего не отправляет', async () => {
      mocks.auth.isUserAuthenticated = false
      const c = compose()
      fillValidPost(c)
      await c.publish()
      expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
      expect(mocks.sendPost).not.toHaveBeenCalled()
    })

    it('невалидный пост: тост с причиной, без отправки', async () => {
      const c = compose()
      c.onMessageInput(TEXT)
      await c.publish()
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'postMsg.validation.tags' })
      expect(mocks.sendPost).not.toHaveBeenCalled()
      expect(c.validationError.value).toBe('tags')
      expect(c.canPublish.value).toBe(false)
    })

    it('недобитый тег без Enter тоже уходит с постом', async () => {
      const c = compose()
      c.onMessageInput(TEXT)
      c.tagInput.value = 'путешествия'
      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].tags).toEqual(['путешествия'])
    })

    it('успех: картинки загружены до транзакции, pending-пост, тост, сброс, лента обновлена', async () => {
      const onPublished = vi.fn()
      const c = compose({ onPublished })
      fillValidPost(c)
      mocks.images.value = ['data:image/jpeg;base64,AAA']
      c.setScheduledTime(1_900_000_000)
      await c.publish()

      expect(mocks.uploadImages).toHaveBeenCalledWith(['data:image/jpeg;base64,AAA'])
      const sent = mocks.sendPost.mock.calls[0]![0]
      expect(sent).toMatchObject({
        message: TEXT,
        tags: ['море'],
        images: ['https://img/0.jpg'],
        language: 'ru',
        settings: { f: '0', t: 1_900_000_000 },
      })
      expect(sent.txidEdit).toBeUndefined()

      expect(mocks.addPending).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tx-new',
          address: ME,
          message: TEXT,
          images: ['https://img/0.jpg'],
          tags: ['море'],
          type: 'share',
        })
      )
      const pending = mocks.addPending.mock.calls[0]![0]
      expect(pending.expiresAt - pending.createdAt).toBe(60_000)

      expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'postMsg.publishSuccess' })
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['feed'] })
      expect(onPublished).toHaveBeenCalledWith('tx-new')
      expect(c.message.value).toBe('')
      expect(c.tags.value).toEqual([])
      expect(c.scheduledTime.value).toBe(0)
      expect(mocks.clearImages).toHaveBeenCalled()
      expect(localStorage.getItem(postDraftKey(ME))).toBeNull()
      expect(c.submitting.value).toBe(false)
    })

    it('правка уходит с txidEdit и не создаёт новый pending-пост', async () => {
      const c = compose({
        mode: 'edit',
        source: { txid: 'tx-old', message: TEXT, tags: ['море'], settings: { f: '2' } },
      })
      await c.publish()
      const sent = mocks.sendPost.mock.calls[0]![0]
      expect(sent.txidEdit).toBe('tx-old')
      expect(sent.settings.f).toBe('2')
      expect(mocks.addPending).not.toHaveBeenCalled()
    })

    it('репост уходит с txidRepost и без тегов', async () => {
      const c = compose({ mode: 'repost', source: { txid: 'tx-orig' } })
      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].txidRepost).toBe('tx-orig')
    })

    it('отказ сети: тост с причиной, форма не сбрасывается', async () => {
      mocks.sendPost.mockRejectedValue(new Error('Дневной лимит постов исчерпан'))
      const c = compose()
      fillValidPost(c)
      await c.publish()
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'Дневной лимит постов исчерпан' })
      expect(c.message.value).toBe(TEXT)
      expect(c.submitting.value).toBe(false)
      expect(mocks.addPending).not.toHaveBeenCalled()
    })

    it('отложенное время 0 или 1 означает «сразу»', () => {
      const c = compose()
      c.setScheduledTime(1)
      expect(c.scheduledTime.value).toBe(0)
      c.setScheduledTime(-5)
      expect(c.scheduledTime.value).toBe(0)
    })
  })

  describe('опрос', () => {
    it('новый опрос уходит в настройки поста s.poll', async () => {
      const c = compose()
      fillValidPost(c)
      c.togglePoll(true)
      c.setPollTitle('Чай или кофе?')
      c.setPollOption(0, 'Чай')
      c.setPollOption(1, 'Кофе')
      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].settings.poll).toEqual({
        title: 'Чай или кофе?',
        list: ['Чай', 'Кофе'],
      })
    })

    it('при правке опрос опубликованного поста переносится как был', async () => {
      const c = compose({
        mode: 'edit',
        source: {
          txid: 'tx-old',
          message: TEXT,
          tags: ['море'],
          settings: { f: '0', poll: { title: 'Куда едем?', list: ['Море', 'Горы'] } },
        },
      })
      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].settings.poll).toEqual({
        title: 'Куда едем?',
        list: ['Море', 'Горы'],
      })
    })
  })

  describe('ссылки и видео', () => {
    it('первая ссылка из текста идёт в u и в карточку; крестик открепляет, текст остаётся', async () => {
      const c = compose()
      fillValidPost(c, `${TEXT}, фото тут https://example.com/trip`)
      expect(c.linkPreviewUrl.value).toBe('https://example.com/trip')

      c.dismissLinkPreview()
      expect(c.linkPreviewUrl.value).toBe('')
      await c.publish()
      const sent = mocks.sendPost.mock.calls[0]![0]
      expect(sent.url).toBeUndefined()
      expect(sent.message).toContain('https://example.com/trip')
    })

    it('видео с YouTube — не карточка ссылки, а видео-пост', () => {
      const c = compose()
      c.onMessageInput(`${TEXT} https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
      expect(c.linkPreviewUrl.value).toBe('')
      expect(c.parsedVideo.value.kind).toBe('youtube')
    })

    it('своё видео: указатель в u, имя файла — заголовок, пока грузится — публиковать нельзя', async () => {
      const c = compose()
      fillValidPost(c)
      c.setVideoUploading(true)
      expect(c.canPublish.value).toBe(false)
      await c.publish()
      expect(mocks.sendPost).not.toHaveBeenCalled()

      c.setVideoUploading(false)
      c.onVideoUploaded({ pointer: 'peertube://host/uuid', title: 'море.mp4' })
      expect(c.caption.value).toBe('море.mp4')
      expect(c.needsCaption.value).toBe(true)
      expect(c.hasUploadedVideo.value).toBe(true)

      c.onVideoUploaded({ pointer: 'peertube://host/uuid2', title: 'другое.mp4' })
      expect(c.caption.value).toBe('море.mp4')

      await c.publish()
      expect(mocks.sendPost.mock.calls[0]![0].url).toBe('peertube://host/uuid2')
    })

    it('ключи для видеосервера — только у вошедшего', () => {
      const c = compose()
      expect(c.videoAuth()).toEqual({ keyPair: { privateKey: 'priv' }, address: ME })
      mocks.auth.getKeyPair = null
      expect(c.videoAuth()).toBeNull()
      c.requireLogin()
      expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
    })
  })

  it('статья: тело — блоки Editor.js, настройки v=a и version=2', async () => {
    const c = compose()
    c.articleMode.value = true
    c.onCaptionInput('Как мы съездили на море')
    c.onArticleChange({ blocks: [{ type: 'paragraph', data: { text: 'Первый день' } }] })
    c.addTag('море')
    await c.publish()
    const sent = mocks.sendPost.mock.calls[0]![0]
    expect(sent.caption).toBe('Как мы съездили на море')
    expect(sent.settings).toMatchObject({ f: '0', v: 'a', version: 2 })
    expect(sent.articleContent.blocks).toHaveLength(1)
    expect(sent.message).toBeUndefined()
  })
})
