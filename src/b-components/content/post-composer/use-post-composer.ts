/**
 * Состояние и логика композера поста (P0: текст + теги; P1: картинки; P4: репост/редактирование).
 *
 * - Режимы: create / edit (префилл + txidEdit) / repost (txidRepost + превью оригинала).
 * - Поля формы: message, caption, tags (+ ввод тега), images (через use-post-images).
 * - Язык берётся из текущей локали i18n.
 * - Валидация — через validatePost (чистая функция).
 * - publish(): авторизация → загрузка картинок (base64→URL) → sendPost → тост → сброс → инвалидация ленты.
 * - Черновик текста автосохраняется в localStorage (только режим create).
 */

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'

import { useAuthStore } from '@/blockchain'
import type { ArticleContent, SharePostData } from '@/blockchain/core/actions/post-action'
import { appToast } from '@/b-components/app-toast'
import { haptic } from '@/helpers/common/haptics'
import { uploadImages } from '@/services/image-upload-service'
import { useModalStore } from '@/stores'
import { t } from '@/i18n'

import {
  type ComposerMode,
  type ComposerSource,
  isArticleSource,
  parseArticleContent,
  postToComposerData,
  sourceId,
} from './composer-source'
import { MAX_POLL_OPTIONS, MAX_TAGS } from './consts'
import { firstVideoUrl, parseVideoUrl } from './parse-video-url'
import { sendPost } from './post-sender'
import { usePostImages } from './use-post-images'
import { validatePost } from './validate-post'

const DRAFT_KEY = 'bastyon_post_draft'

/** Нормализует тег: lowercase + только буквы/цифры (legacy regex kit.js). */
export function normalizeTag(raw: string): string {
  return raw.toLowerCase().replace(/[^0-9a-zа-яё]/gi, '')
}

export interface UsePostComposerOptions {
  /** Колбэк после успешной публикации (txid). Напр. закрыть модалку / перейти в ленту. */
  onPublished?: (txid: string) => void
  /** Режим: create (по умолчанию) / edit / repost. */
  mode?: ComposerMode
  /** Источник для edit (префилл + txidEdit) или repost (txidRepost + превью). */
  source?: ComposerSource | null
}

export function usePostComposer(options: UsePostComposerOptions = {}) {
  const { locale } = useI18n()
  const authStore = useAuthStore()
  const modalStore = useModalStore()
  const queryClient = useQueryClient()

  const readDraft = (): string => {
    try {
      return localStorage.getItem(DRAFT_KEY) || ''
    } catch {
      return ''
    }
  }
  const writeDraft = (text: string): void => {
    try {
      if (text.trim()) localStorage.setItem(DRAFT_KEY, text)
      else localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* приватный режим — игнорируем */
    }
  }

  const mode = options.mode ?? 'create'
  const isEdit = mode === 'edit'
  const isRepost = mode === 'repost'

  const {
    images,
    full: imagesFull,
    base64List,
    addFiles,
    remove: removeImage,
    rotate: rotateImage,
    clear: clearImages,
    setFromUrls,
  } = usePostImages()

  // Редактируем ли статью (определяем по источнику).
  const editingArticle = isEdit && options.source ? isArticleSource(options.source) : false

  // Префилл по режиму. Черновик читаем только в create. Для статьи message не используется.
  const prefill = options.source && (isEdit || isRepost) ? postToComposerData(options.source) : null

  const message = ref(
    isEdit && prefill && !editingArticle
      ? prefill.message
      : isRepost
        ? ''
        : !isEdit
          ? readDraft()
          : ''
  )
  const caption = ref(isEdit && prefill ? prefill.caption : '')
  const tags = ref<string[]>(isEdit && prefill ? prefill.tags : [])
  const tagInput = ref('')
  const submitting = ref(false)
  const visibility = ref('0')
  const language = ref(locale.value)

  /** Опрос. */
  const pollActive = ref(false)
  const pollTitle = ref('')
  const pollOptions = ref<string[]>(['', ''])

  /** Отложенная публикация: unix-секунды (0 — сразу). */
  const scheduledTime = ref(0)

  /** Режим статьи (Editor.js). Включается тоглом в create или при редактировании статьи. */
  const articleMode = ref(editingArticle)
  const articleContent = ref<ArticleContent | null>(
    editingArticle && options.source ? parseArticleContent(options.source) : null
  )

  /** txid редактируемого / репостируемого поста. */
  const editId = ref(isEdit && options.source ? sourceId(options.source) : '')
  const repostId = ref(isRepost && options.source ? sourceId(options.source) : '')
  /** Оригинал для превью в режиме репоста. */
  const repostSource = isRepost ? (options.source ?? null) : null

  // Картинки префилим только для обычного поста (у статьи картинки внутри блоков).
  if (isEdit && prefill && !editingArticle && prefill.images.length) setFromUrls(prefill.images)

  /** Триал-аккаунты не могут ограничивать видимость — только публичные посты (legacy). */
  const isTrial = computed(() => authStore.getUserState?.trial === true)
  /** Эффективная видимость с учётом триал-гейтинга. */
  const effectiveVisibility = computed(() => (isTrial.value ? '0' : visibility.value))

  /** Очищенный опрос (если активен и валиден по форме): { title, list } непустых опций. */
  const cleanedPoll = computed(() => {
    if (!pollActive.value) return undefined
    const list = pollOptions.value.map((o) => o.trim()).filter(Boolean)
    return { title: pollTitle.value.trim(), list }
  })

  /** Базовые настройки: видимость + (опц.) отложенное время. */
  const baseSettings = computed(() => {
    const s: SharePostData['settings'] = { f: effectiveVisibility.value }
    if (scheduledTime.value > 1) s!.t = scheduledTime.value
    return s
  })

  /** Видео-ссылка, авто-найденная в тексте поста (youtube/vimeo/peertube). */
  const videoUrl = computed(() => (articleMode.value ? '' : firstVideoUrl(message.value)))
  const parsedVideo = computed(() => parseVideoUrl(videoUrl.value))
  /** peertube-видео/аудио требуют заголовок (caption) — показываем поле title. */
  const needsCaption = computed(
    () => parsedVideo.value.kind === 'peertube' || parsedVideo.value.kind === 'audio'
  )

  /**
   * Текущий пост в форме SharePostData.
   * На этапе валидации/превью images содержат base64; перед отправкой они
   * заменяются на загруженные URL (см. publish).
   */
  const post = computed<SharePostData>(() => {
    if (articleMode.value) {
      // Статья: тело — Editor.js {blocks}, заголовок — caption; settings.v='a', version=2.
      return {
        caption: caption.value.trim(),
        articleContent: articleContent.value ?? { blocks: [] },
        tags: tags.value,
        language: language.value,
        settings: { ...baseSettings.value, v: 'a', version: 2 },
        txidEdit: editId.value || undefined,
      }
    }
    return {
      message: message.value.trim(),
      caption: caption.value.trim(),
      url: videoUrl.value || undefined,
      tags: tags.value,
      images: base64List.value,
      poll: cleanedPoll.value,
      language: language.value,
      settings: baseSettings.value,
      txidEdit: editId.value || undefined,
      txidRepost: repostId.value || undefined,
    }
  })

  const validationError = computed(() => validatePost(post.value))
  const canPublish = computed(() => !submitting.value && validationError.value === null)
  const tagsFull = computed(() => tags.value.length >= MAX_TAGS)

  /** Лейбл кнопки публикации по режиму. */
  const publishLabel = computed(() => {
    if (isEdit) return t('postComposer.save')
    if (isRepost) return t('postComposer.repostPublish')
    return t('postComposer.publish')
  })

  const onMessageInput = (value: string): void => {
    message.value = value
    // Черновик персистим только в режиме создания (edit/repost не засоряют его).
    if (mode === 'create') writeDraft(value)
  }

  const onCaptionInput = (value: string): void => {
    caption.value = value
  }

  const onArticleChange = (value: ArticleContent): void => {
    articleContent.value = value
  }

  // --- Опрос ---
  const togglePoll = (active: boolean): void => {
    pollActive.value = active
    if (!active) {
      pollTitle.value = ''
      pollOptions.value = ['', '']
    }
  }
  const setPollTitle = (value: string): void => {
    pollTitle.value = value
  }
  const setPollOption = (index: number, value: string): void => {
    pollOptions.value = pollOptions.value.map((o, i) => (i === index ? value : o))
  }
  const addPollOption = (): void => {
    if (pollOptions.value.length < MAX_POLL_OPTIONS) pollOptions.value = [...pollOptions.value, '']
  }
  const removePollOption = (index: number): void => {
    if (pollOptions.value.length > 2) {
      pollOptions.value = pollOptions.value.filter((_, i) => i !== index)
    }
  }

  // --- Отложенная публикация ---
  const setScheduledTime = (unixSeconds: number): void => {
    scheduledTime.value = unixSeconds > 1 ? unixSeconds : 0
  }

  const addTag = (raw: string): void => {
    const norm = normalizeTag(raw)
    if (!norm) return
    if (tags.value.includes(norm)) return
    if (tags.value.length >= MAX_TAGS) return
    tags.value.push(norm)
    tagInput.value = ''
  }

  const commitTagInput = (): void => {
    if (tagInput.value.trim()) addTag(tagInput.value)
  }

  const removeTag = (tag: string): void => {
    tags.value = tags.value.filter((x) => x !== tag)
  }

  /** Backspace в пустом поле тега удаляет последний тег. */
  const onTagBackspace = (): void => {
    if (!tagInput.value && tags.value.length > 0) {
      tags.value = tags.value.slice(0, -1)
    }
  }

  const reset = (): void => {
    message.value = ''
    caption.value = ''
    tags.value = []
    tagInput.value = ''
    visibility.value = '0'
    language.value = locale.value
    articleMode.value = false
    articleContent.value = null
    pollActive.value = false
    pollTitle.value = ''
    pollOptions.value = ['', '']
    scheduledTime.value = 0
    clearImages()
    if (mode === 'create') writeDraft('')
  }

  const publish = async (): Promise<void> => {
    if (!authStore.isUserAuthenticated) {
      modalStore.openAuthModal('login')
      return
    }

    // Закоммитить недобитый ввод тега (пользователь не нажал Enter).
    commitTagInput()

    const error = validatePost(post.value)
    if (error) {
      appToast.error({ message: t(`postMsg.validation.${error}`) })
      return
    }

    submitting.value = true
    try {
      // Загружаем картинки (base64 → URL) до сборки транзакции.
      const imageUrls = await uploadImages(base64List.value)
      const txid = await sendPost({ ...post.value, images: imageUrls })
      haptic('small')
      appToast.success({ message: t('postMsg.publishSuccess') })
      reset()
      await queryClient.invalidateQueries({ queryKey: ['feed'] })
      options.onPublished?.(txid)
    } catch (e) {
      appToast.error({
        message: e instanceof Error ? e.message : t('postMsg.errSendFailed'),
      })
    } finally {
      submitting.value = false
    }
  }

  return {
    mode,
    isEdit,
    isRepost,
    repostSource,
    publishLabel,
    message,
    caption,
    tags,
    tagInput,
    submitting,
    images,
    imagesFull,
    visibility,
    language,
    isTrial,
    articleMode,
    articleContent,
    parsedVideo,
    needsCaption,
    caption,
    pollActive,
    pollTitle,
    pollOptions,
    scheduledTime,
    validationError,
    canPublish,
    tagsFull,
    onMessageInput,
    onCaptionInput,
    onArticleChange,
    togglePoll,
    setPollTitle,
    setPollOption,
    addPollOption,
    removePollOption,
    setScheduledTime,
    addTag,
    commitTagInput,
    removeTag,
    onTagBackspace,
    addImageFiles: addFiles,
    removeImage,
    rotateImage,
    reset,
    publish,
  }
}
