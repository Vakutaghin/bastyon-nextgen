/**
 * Состояние и логика композера поста (P0: текст + теги; P1: картинки; P4: репост/редактирование).
 *
 * - Режимы: create / edit (префилл + txidEdit) / repost (txidRepost + превью оригинала).
 * - Поля формы: message, caption, tags (+ ввод тега), images (через use-post-images).
 * - Язык берётся из текущей локали i18n.
 * - Валидация — через validatePost (чистая функция).
 * - publish(): авторизация → загрузка картинок (base64→URL) → sendPost → тост → сброс → инвалидация ленты.
 * - Черновик (только режим create): текст — в localStorage, остальное —
 *   теги, картинки, опрос, видимость, язык, время, статья, своё видео — в
 *   IndexedDB (post-draft). «Очистить» (reset) стирает всё.
 */

import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'

import { useAuthStore } from '@/blockchain'
import type { ArticleContent, SharePostData } from '@/blockchain/core/actions/post-action'
import { appToast } from '@/b-components/app-toast'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { encodeArticleContent } from '@/helpers/content/article-codec'
import { parsePoll } from '@/helpers/content/poll'
import { haptic } from '@/helpers/common/haptics'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { uploadImages } from '@/services/image-upload-service'
import { useModalStore } from '@/stores'
import { t } from '@/i18n'

import {
  type ComposerMode,
  type ComposerSource,
  type ComposerSharePrefill,
  ComposerVideoPrefill,
  isArticleSource,
  parseArticleContent,
  postToComposerData,
  sourceId,
} from './composer-source'
import { firstLinkUrl, firstVideoUrl, parseVideoUrl } from './parse-video-url'
import { sendPost } from './post-sender'
import { trackPendingPost } from './pending-post'
import { usePostImages } from './use-post-images'
import { usePostTags } from './use-post-tags'
import { usePostPoll } from './use-post-poll'
import {
  type PostDraftFields,
  readDraft,
  readStoredDraft,
  writeDraft,
  writeDraftFields,
  writeDraftImages,
} from './post-draft'
import { validatePost } from './validate-post'
import { UPLOADING_VIDEO_POINTER } from './consts'

/** Пауза перед записью черновика в IndexedDB: не писать на каждую букву подписи. */
const DRAFT_SAVE_DELAY_MS = 400

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i])

export interface UsePostComposerOptions {
  /** Колбэк после успешной публикации (txid). Напр. закрыть модалку / перейти в ленту. */
  onPublished?: (txid: string) => void
  /** Режим: create (по умолчанию) / edit / repost. */
  mode?: ComposerMode
  /** Источник для edit (префилл + txidEdit) или repost (txidRepost + превью). */
  source?: ComposerSource | null
  /**
   * Новый пост с уже загруженным своим видео («Медиастудия» → «Создать пост»):
   * видео прикреплено, его название — заголовок. Картинки черновика не
   * подтягиваются: с видео они в одном посте не живут.
   */
  video?: ComposerVideoPrefill | null
  /** Новый пост с готовым текстом и картинками («Поделиться в Bastyon» из приложения). */
  share?: ComposerSharePrefill | null
}

export function usePostComposer(options: UsePostComposerOptions = {}) {
  const { locale } = useI18n()
  const authStore = useAuthStore()
  const modalStore = useModalStore()
  const queryClient = useQueryClient()

  const mode = options.mode ?? 'create'
  const isEdit = mode === 'edit'
  const isRepost = mode === 'repost'

  const {
    images,
    full: imagesFull,
    base64List,
    addFiles,
    remove: removeImage,
    move: moveImage,
    rotate: rotateImage,
    replace: replaceImage,
    clear: clearImages,
    setFromUrls,
  } = usePostImages()

  // Редактируем ли статью (определяем по источнику).
  const editingArticle = isEdit && options.source ? isArticleSource(options.source) : false

  // Префилл по режиму. Черновик читаем только в create. Для статьи message не используется.
  const prefill = options.source && (isEdit || isRepost) ? postToComposerData(options.source) : null
  const prefillShare = mode === 'create' && options.share ? options.share : null
  /** Форма живёт черновиком: создание поста, кроме «поделиться» из приложения. */
  const keepsDraft = mode === 'create' && !prefillShare

  const message = ref(
    isEdit && prefill && !editingArticle
      ? prefill.message
      : isRepost
        ? ''
        : prefillShare
          ? prefillShare.message
          : !isEdit
            ? readDraft(authStore.getUserAddress)
            : ''
  )
  const prefillVideo = mode === 'create' && options.video?.pointer ? options.video : null
  const caption = ref(isEdit && prefill ? prefill.caption : (prefillVideo?.title ?? ''))
  const {
    tags,
    tagInput,
    tagsFull,
    postTags,
    addTag,
    commitTagInput,
    removeTag,
    onTagBackspace,
    resetTags,
  } = usePostTags(isEdit && prefill ? prefill.tags : (prefillShare?.tags ?? []))
  const submitting = ref(false)
  // При правке сохраняем видимость и язык оригинала: раньше они сбрасывались
  // на дефолт, и пост «только подписчикам» после исправления опечатки
  // становился публичным, а язык — текущим языком интерфейса (V36).
  const visibility = ref(isEdit && prefill ? prefill.visibility : '0')
  const language = ref(isEdit && prefill && prefill.language ? prefill.language : locale.value)

  /** Опрос — в use-post-poll. */
  const {
    pollActive,
    pollTitle,
    pollOptions,
    cleanedPoll,
    togglePoll,
    setPollTitle,
    setPollOption,
    addPollOption,
    removePollOption,
    resetPoll,
    restorePoll,
  } = usePostPoll()

  /** Отложенная публикация: unix-секунды (0 — сразу). */
  const scheduledTime = ref(0)

  /** Режим статьи (Editor.js). Включается тоглом в create или при редактировании статьи. */
  const articleMode = ref(editingArticle)
  // Текст статьи источника уже раскодирован адаптером поста (decodePostBody).
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
  if (prefillShare?.images.length) setFromUrls(prefillShare.images)

  /** Триал-аккаунты не могут ограничивать видимость — только публичные посты (legacy). */
  const isTrial = computed(() => authStore.getUserState?.trial === true)
  /** Эффективная видимость с учётом триал-гейтинга. */
  const effectiveVisibility = computed(() => (isTrial.value ? '0' : visibility.value))

  /**
   * Видимость «платным подписчикам» (f='3') — только у автора с назначенной
   * ценой подписки (accSet.paidsubscription), как в старом клиенте: без цены
   * оформить подписку нельзя, и такой пост не увидел бы никто. Цена — из стора
   * платных подписок: только что назначенная видна до подтверждения сетью.
   * Нода не ответила — пункт не показываем; правку поста с f='3' это не ломает.
   */
  const paidSubscriptions = usePaidSubscriptionsStore()
  const ownAddress = authStore.getUserAddress
  if (ownAddress) void paidSubscriptions.ensurePrice(ownAddress)
  const paidVisibilityAvailable = computed(
    () => !!ownAddress && (paidSubscriptions.priceOf(ownAddress) ?? 0) > 0
  )

  // Опрос уходит в настройки (`s.poll`): поле `p`, которое заполнял старый
  // клиент, нода не хранит. При правке — опрос опубликованного поста как есть:
  // голоса привязаны к номерам вариантов, менять их после публикации нельзя.
  const published = isEdit ? parsePoll(options.source?.settings?.poll) : null
  const publishedPoll = published ? { title: published.title, list: published.options } : null
  const withPoll = (settings: SharePostData['settings']): SharePostData['settings'] => {
    const poll = publishedPoll ?? (cleanedPoll.value?.list.length ? cleanedPoll.value : null)
    return poll ? { ...settings, poll } : settings
  }

  /** Базовые настройки: видимость + (опц.) отложенное время. */
  const baseSettings = computed(() => {
    const s: SharePostData['settings'] = { f: effectiveVisibility.value }
    if (scheduledTime.value > 1) s!.t = scheduledTime.value
    return s
  })

  /**
   * Указатель загруженного видео (peertube://…), пришедший из аплоадера, а НЕ из текста.
   * Мост Фазы E: аплоадер кладёт сюда указатель → он питает post.url и needsCaption,
   * даже когда пользователь ничего не писал в теле. Приоритет над авто-ссылкой из текста.
   */
  // При правке — ссылка оригинала: без неё видео/аудио-пост сохранялся как
  // обычный `share` с пустым `u` (V36).
  const uploadedVideoUrl = ref(isEdit && prefill ? prefill.url : (prefillVideo?.pointer ?? ''))

  /** Видео-ссылка, авто-найденная в тексте поста (youtube/vimeo/peertube). */
  const videoUrl = computed(() => (articleMode.value ? '' : firstVideoUrl(message.value)))
  /** Эффективный url видео: загруженный указатель приоритетнее авто-ссылки из текста. */
  const effectiveVideoUrl = computed(() => uploadedVideoUrl.value || videoUrl.value)
  const parsedVideo = computed(() => parseVideoUrl(effectiveVideoUrl.value))

  /** Своё видео грузится прямо сейчас: указателя ещё нет; «Опубликовать» дождётся его. */
  const videoUploading = ref(false)
  const setVideoUploading = (active: boolean): void => {
    videoUploading.value = active
  }

  /** Ссылка, которую автор убрал крестиком на карточке: её в `u` не кладём. */
  const dismissedLinkUrl = ref('')
  /** Обычная веб-ссылка из текста (как `linksFromText` старого клиента), если видео нет. */
  const textLinkUrl = computed(() => {
    if (articleMode.value) return ''
    const link = firstLinkUrl(message.value)
    return link && link !== dismissedLinkUrl.value ? link : ''
  })
  /** `u` поста: видео (загруженное или из текста), иначе обычная ссылка. */
  const postUrl = computed(() => effectiveVideoUrl.value || textLinkUrl.value)
  /** Ссылка под карточку превью: `u`, если это не видео (у видео свой плеер). */
  const linkPreviewUrl = computed(() =>
    postUrl.value && !parseVideoUrl(postUrl.value).kind ? postUrl.value : ''
  )
  /** Крестик на карточке: ссылка остаётся в тексте, но в пост не прикрепляется. */
  const dismissLinkPreview = (): void => {
    dismissedLinkUrl.value = linkPreviewUrl.value
    // При правке `u` оригинала лежит в uploadedVideoUrl (V36) — убираем и оттуда.
    if (uploadedVideoUrl.value === linkPreviewUrl.value) uploadedVideoUrl.value = ''
  }
  /** Своё видео ещё грузится: указателя нет, но пост уже с роликом. */
  const videoPending = computed(() => videoUploading.value && !uploadedVideoUrl.value)
  /**
   * peertube-видео/аудио требуют заголовок (caption) — показываем поле title.
   * И пока своё видео грузится: заголовок пишут, не дожидаясь загрузки.
   */
  const needsCaption = computed(
    () =>
      parsedVideo.value.kind === 'peertube' ||
      parsedVideo.value.kind === 'audio' ||
      videoPending.value
  )

  /** Аплоадер вызывает после успешной загрузки: подставить указатель в пост. */
  const setUploadedVideoUrl = (pointer: string): void => {
    uploadedVideoUrl.value = pointer || ''
  }
  const clearUploadedVideoUrl = (): void => {
    uploadedVideoUrl.value = ''
  }

  /** Видео загружено из композера (а не пришло с правкой): у него своя панель. */
  const hasUploadedVideo = computed(() => !isEdit && !!uploadedVideoUrl.value)
  /** Загрузка закончилась: указатель — в `u`, имя файла — заготовка заголовка. */
  const onVideoUploaded = (video: { pointer: string; title: string }): void => {
    setUploadedVideoUrl(video.pointer)
    if (!caption.value.trim()) caption.value = video.title
  }
  /** Ключи для входа на видеосервер; null — не вошёл. */
  const videoAuth = () => {
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress
    return keyPair && address ? { keyPair, address } : null
  }
  const requireLogin = (): void => {
    modalStore.openAuthModal('login')
  }

  /**
   * Текущий пост в форме SharePostData.
   * На этапе валидации/превью images содержат base64; перед отправкой они
   * заменяются на загруженные URL (см. publish).
   */
  const post = computed<SharePostData>(() => {
    if (articleMode.value) {
      // Статья: тело — Editor.js {blocks} с закодированным текстом (как у старого
      // клиента), заголовок — caption; settings.v='a', version=2.
      return {
        caption: caption.value.trim(),
        articleContent: encodeArticleContent(articleContent.value ?? { blocks: [] }),
        tags: postTags.value,
        language: language.value,
        settings: { ...baseSettings.value, v: 'a', version: 2 },
        txidEdit: editId.value || undefined,
      }
    }
    return {
      message: message.value.trim(),
      caption: caption.value.trim(),
      // Пока видео грузится, проверяем пост как видео: заголовок обязателен.
      url: postUrl.value || (videoPending.value ? UPLOADING_VIDEO_POINTER : undefined),
      tags: postTags.value,
      images: base64List.value,
      poll: cleanedPoll.value,
      language: language.value,
      settings: withPoll(baseSettings.value),
      txidEdit: editId.value || undefined,
      txidRepost: repostId.value || undefined,
    }
  })

  const validationError = computed(() => validatePost(post.value))
  /** В статью грузится картинка: в пост попала бы статья без неё. */
  const articleUploading = ref(false)
  const setArticleUploading = (active: boolean): void => {
    articleUploading.value = active
  }
  /** «Опубликовать» нажали, пока видео грузилось: пост уйдёт, когда оно загрузится. */
  const waitingForVideo = ref(false)
  const cancelWaiting = (): void => {
    waitingForVideo.value = false
  }
  const canPublish = computed(
    () =>
      !submitting.value &&
      !waitingForVideo.value &&
      !articleUploading.value &&
      validationError.value === null
  )
  /** Лейбл кнопки публикации по режиму. */
  const publishLabel = computed(() => {
    if (isEdit) return t('postComposer.save')
    if (isRepost) return t('postComposer.repostPublish')
    return t('postComposer.publish')
  })

  const onMessageInput = (value: string): void => {
    message.value = value
    // Черновик персистим только в режиме создания (edit/repost не засоряют его).
    if (keepsDraft) writeDraft(draftAddress, value)
  }

  const onCaptionInput = (value: string): void => {
    caption.value = value
  }

  const onArticleChange = (value: ArticleContent): void => {
    articleContent.value = value
  }

  // --- Отложенная публикация ---
  const setScheduledTime = (unixSeconds: number): void => {
    scheduledTime.value = unixSeconds > 1 ? unixSeconds : 0
  }

  // --- Черновик в IndexedDB (только create) ---
  const draftAddress = authStore.getUserAddress
  const defaultLanguage = locale.value

  /** Всё, кроме текста и картинок, — как оно ляжет в черновик. */
  const draftFields = computed<PostDraftFields>(() => ({
    caption: caption.value,
    tags: [...tags.value],
    visibility: visibility.value,
    language: language.value,
    poll: { active: pollActive.value, title: pollTitle.value, options: [...pollOptions.value] },
    scheduledTime: scheduledTime.value,
    articleMode: articleMode.value,
    articleContent: articleContent.value,
    videoUrl: uploadedVideoUrl.value,
    dismissedLinkUrl: dismissedLinkUrl.value,
  }))

  /** Поля как у нового поста — хранить нечего. */
  const isEmptyFields = (f: PostDraftFields): boolean =>
    !f.caption.trim() &&
    f.tags.length === 0 &&
    f.visibility === '0' &&
    (!f.language || f.language === defaultLanguage) &&
    !f.poll.active &&
    f.scheduledTime === 0 &&
    !f.articleMode &&
    !f.articleContent?.blocks?.length &&
    !f.videoUrl &&
    !f.dismissedLinkUrl

  /** В черновике что-то есть — есть что очищать. */
  const hasDraft = computed(
    () => !!message.value.trim() || images.value.length > 0 || !isEmptyFields(draftFields.value)
  )
  const canReset = computed(() => mode === 'create' && hasDraft.value && !submitting.value)

  // Что лежит в IndexedDB сейчас: пишем только разницу.
  let storedFieldsJson = 'null'
  let storedImages: string[] = []
  // Пока черновик читается, пустая форма не должна затереть сохранённое.
  let restoring = keepsDraft
  let fieldsTimer: ReturnType<typeof setTimeout> | null = null
  let imagesTimer: ReturnType<typeof setTimeout> | null = null

  const saveFields = (): void => {
    fieldsTimer = null
    if (restoring) return
    const fields = isEmptyFields(draftFields.value) ? null : draftFields.value
    const json = JSON.stringify(fields)
    if (json === storedFieldsJson) return
    storedFieldsJson = json
    writeDraftFields(draftAddress, fields).catch((e: unknown) =>
      console.warn('[post-composer] draft save failed', e)
    )
  }
  const saveImages = (): void => {
    imagesTimer = null
    if (restoring) return
    const list = [...base64List.value]
    if (sameList(list, storedImages)) return
    storedImages = list
    writeDraftImages(draftAddress, list).catch((e: unknown) =>
      console.warn('[post-composer] draft images save failed', e)
    )
  }

  const applyDraftFields = (f: PostDraftFields): void => {
    caption.value = f.caption
    tags.value = [...f.tags]
    visibility.value = f.visibility
    language.value = f.language || locale.value
    restorePoll(f.poll)
    // Время, которое уже прошло, не возвращаем: такой пост нода не примет.
    scheduledTime.value = f.scheduledTime > Date.now() / 1000 ? f.scheduledTime : 0
    articleMode.value = f.articleMode
    articleContent.value = f.articleContent
    uploadedVideoUrl.value = f.videoUrl
    dismissedLinkUrl.value = f.dismissedLinkUrl
  }

  if (keepsDraft) {
    watch(
      draftFields,
      () => {
        if (fieldsTimer) clearTimeout(fieldsTimer)
        fieldsTimer = setTimeout(saveFields, DRAFT_SAVE_DELAY_MS)
      },
      { deep: true }
    )
    watch(base64List, () => {
      if (imagesTimer) clearTimeout(imagesTimer)
      imagesTimer = setTimeout(saveImages, DRAFT_SAVE_DELAY_MS)
    })
    // Окно закрыли сразу после правки — дописываем, не дожидаясь паузы. Сверяем
    // всегда: наблюдатель мог ещё не успеть поставить таймер, а записывается
    // только то, что отличается от сохранённого.
    if (getCurrentScope()) {
      onScopeDispose(() => {
        for (const timer of [fieldsTimer, imagesTimer]) if (timer) clearTimeout(timer)
        saveFields()
        saveImages()
      })
    }
    readStoredDraft(draftAddress)
      .then(({ fields, images: savedImages }) => {
        // Пока черновик читался, человек мог уже что-то поменять — его правки важнее.
        if (fields) {
          storedFieldsJson = JSON.stringify(fields)
          if (isEmptyFields(draftFields.value)) applyDraftFields(fields)
        }
        if (savedImages.length) {
          storedImages = savedImages
          if (!images.value.length && !prefillVideo) setFromUrls(savedImages)
        }
      })
      .catch((e: unknown) => console.warn('[post-composer] draft restore failed', e))
      .finally(() => {
        restoring = false
        saveFields()
        saveImages()
      })
  }

  /** Стереть черновик в хранилищах (форма очищается отдельно). */
  const clearStoredDraft = (): void => {
    if (!keepsDraft) return
    writeDraft(draftAddress, '')
    for (const timer of [fieldsTimer, imagesTimer]) if (timer) clearTimeout(timer)
    fieldsTimer = null
    imagesTimer = null
    storedFieldsJson = 'null'
    storedImages = []
    Promise.all([writeDraftFields(draftAddress, null), writeDraftImages(draftAddress, [])]).catch(
      (e: unknown) => console.warn('[post-composer] draft clear failed', e)
    )
  }

  const reset = (): void => {
    message.value = ''
    caption.value = ''
    resetTags()
    visibility.value = '0'
    language.value = locale.value
    articleMode.value = false
    articleContent.value = null
    resetPoll()
    scheduledTime.value = 0
    uploadedVideoUrl.value = ''
    dismissedLinkUrl.value = ''
    waitingForVideo.value = false
    clearImages()
    clearStoredDraft()
  }

  const publish = async (): Promise<void> => {
    // Публикация уже идёт: второй вызов дал бы дубль поста.
    if (submitting.value) return
    if (!authStore.isUserAuthenticated) {
      modalStore.openAuthModal('login')
      return
    }
    // Аккаунт сменили, пока форма была открыта: пост ушёл бы от имени нового
    // (use-account-switch-reset форму закрывает, это — последний рубеж).
    if (authStore.getUserAddress !== ownAddress) return

    if (articleUploading.value) return

    // Закоммитить недобитый ввод тега (пользователь не нажал Enter).
    commitTagInput()

    const error = validatePost(post.value)
    if (error) {
      appToast.error({ message: t(`postMsg.validation.${error}`) })
      return
    }
    // Видео ещё грузится или его обложка не на сервере — пост уйдёт сам, когда
    // всё будет готово: второй раз нажимать не нужно.
    if (videoUploading.value) {
      waitingForVideo.value = true
      return
    }

    submitting.value = true
    try {
      // Загружаем картинки (base64 → URL) до сборки транзакции. Главное в
      // сообщении — что делать; коды причин («peertube: peertube_image_token_400»)
      // идут мелкой строкой ниже: по ним видно, где именно не вышло.
      const imageUrls = await uploadImages(base64List.value).catch((e: unknown) => {
        console.warn('[post-composer] image upload failed', e)
        throw new Error(t('postMsg.errImageUpload'), { cause: e })
      })
      const finalPost: SharePostData = { ...post.value, images: imageUrls }
      const txid = await sendPost(finalPost)

      trackPendingPost(finalPost, txid)

      haptic('small')
      appToast.success({ message: t('postMsg.publishSuccess') })
      reset()
      await queryClient.invalidateQueries({ queryKey: ['feed'] })
      options.onPublished?.(txid)
    } catch (e) {
      const cause = e instanceof Error ? e.cause : undefined
      appToast.error({
        // Сетевой сбой — словами, а не «All RPC servers failed…».
        message: e instanceof Error ? extractErrorMessage(e) : t('postMsg.errSendFailed'),
        ...(cause instanceof Error ? { description: cause.message } : {}),
      })
    } finally {
      submitting.value = false
    }
  }

  watch(videoUploading, (busy) => {
    if (busy || !waitingForVideo.value) return
    waitingForVideo.value = false
    // Загрузка сорвалась или видео убрали — пост без него не отправляем.
    if (uploadedVideoUrl.value) void publish()
  })

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
    paidVisibilityAvailable,
    articleMode,
    articleContent,
    parsedVideo,
    needsCaption,
    linkPreviewUrl,
    dismissLinkPreview,
    uploadedVideoUrl,
    setUploadedVideoUrl,
    clearUploadedVideoUrl,
    videoUploading,
    waitingForVideo,
    cancelWaiting,
    articleUploading,
    setArticleUploading,
    setVideoUploading,
    hasUploadedVideo,
    onVideoUploaded,
    videoAuth,
    requireLogin,
    pollActive,
    pollTitle,
    pollOptions,
    scheduledTime,
    validationError,
    canPublish,
    canReset,
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
    moveImage,
    rotateImage,
    replaceImage,
    reset,
    publish,
  }
}
