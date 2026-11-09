// Форма ответа: parentid/answerid как в legacy (K4), черновик корневой формы в
// localStorage, переключение цели ответа с префиксом @ника, @-меню с клавиатуры,
// эмодзи в позицию курсора, проверки перед отправкой и откат при ошибке.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, nextTick, ref, type Ref } from 'vue'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { MentionUser } from '../types'
import type { DisableReason } from '../visibility'

const { sendComment, commentsStore, toast } = vi.hoisted(() => ({
  sendComment: vi.fn(async (..._args: unknown[]): Promise<string> => 'TXID'),
  commentsStore: { addPending: vi.fn(), replacePendingId: vi.fn(), removePending: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k, tn: (k: string, n: number) => `${k}:${n}` }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/helpers/common/haptics', () => ({ haptic: vi.fn() }))
vi.mock('@/helpers/common/post-title-resolver', () => ({
  resolvePostTitleFromPost: () => ({ title: 'T' }),
}))
const notificationsStore = vi.hoisted(() => ({ markAnswered: vi.fn() }))
vi.mock('@/stores', () => ({
  useCommentsStore: () => commentsStore,
  usePostsStore: () => ({ getPostByShareId: () => undefined }),
  useNotificationsStore: () => notificationsStore,
}))
vi.mock('../comment-sender', () => ({ sendComment }))

import { useCommentForm } from './use-comment-form'
import { commentDraftKey } from './comment-draft-storage'
import { COMMENT_MAX_LENGTH, COMMENTS_ALREADY_SHOWN, COMMENTS_PAGE_SIZE } from '../consts'

interface FormSetup {
  allComments?: GetComment[] | null
  visibleCommentsCount?: number
  commentsCollapsed?: boolean
  disableReason?: DisableReason | null
  mentionUsers?: MentionUser[]
  refreshAllComments?: () => Promise<void>
  rootTextarea?: unknown
}

function form(setup: FormSetup = {}) {
  const repliesExpanded = ref<Record<string, boolean>>({})
  const allComments = ref(setup.allComments === undefined ? [] : setup.allComments) as Ref<
    GetComment[] | null
  >
  const visibleCommentsCount = ref(setup.visibleCommentsCount ?? 0)
  const commentsCollapsed = ref(setup.commentsCollapsed ?? false)
  const disableReason = ref<DisableReason | null>(setup.disableReason ?? null)
  const mentionUsers = ref<MentionUser[]>(setup.mentionUsers ?? [])
  const emitComment = vi.fn()
  const refreshAllComments = vi.fn(setup.refreshAllComments ?? (async () => {}))
  const api = useCommentForm({
    postId: ref('POST'),
    currentUserAddress: ref('ME'),
    composerDisableReason: disableReason,
    allComments,
    visibleCommentsCount,
    commentsCollapsed,
    repliesExpanded,
    refreshAllComments,
    emitComment,
    rootMentionListRef: ref(null),
    mentionListRef: ref(null),
    rootReplyTextareaRef: ref(setup.rootTextarea ?? null),
    replyTextareaRef: ref(null),
    filteredMentionUsers: computed(() => mentionUsers.value),
  })
  return {
    api,
    repliesExpanded,
    allComments,
    visibleCommentsCount,
    commentsCollapsed,
    disableReason,
    emitComment,
    refreshAllComments,
  }
}

const savedDraft = () => localStorage.getItem(commentDraftKey('ME', 'POST'))

/** Событие ввода с textarea, где курсор стоит в `pos` (по умолчанию — в конце). */
function inputEvent(value: string, pos = value.length): Event {
  const el = document.createElement('textarea')
  el.value = value
  el.setSelectionRange(pos, pos)
  return { target: el } as unknown as Event
}

function keydown(key: string, mods: Partial<KeyboardEvent> = {}) {
  const preventDefault = vi.fn()
  return {
    event: {
      key,
      ctrlKey: false,
      metaKey: false,
      preventDefault,
      ...mods,
    } as unknown as KeyboardEvent,
    preventDefault,
  }
}

const root = { id: 'c1', parentid: '', address: 'A', userprofile: { name: 'alice' } } as never
const reply = { id: 'r1', parentid: 'c1', address: 'B', userprofile: { name: 'bob' } } as never

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sendComment.mockImplementation(async () => 'TXID')
})

describe('sendReply — parentid/answerid как в legacy (K4)', () => {
  it('ответ на ответ уходит с parentid = корень ветки, answerid = сам ответ', async () => {
    const { api, repliesExpanded } = form()
    api.onReplyToSecondLevel(reply)
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'r1', 'hi')
    expect(commentsStore.addPending).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'c1', answerId: 'r1', postId: 'POST' })
    )
    expect(repliesExpanded.value['c1']).toBe(true)
    expect(commentsStore.replacePendingId).toHaveBeenCalledWith(
      'POST',
      expect.stringMatching(/^local-/),
      'TXID'
    )
  })

  it('«ответить автору» на ответ: префикс @ник, parentid = корень', async () => {
    const { api } = form()
    api.onReplyToComment(reply)
    expect(api.replyDraft.value).toBe('@bob, ')
    api.replyDraft.value = '@bob, ok'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'r1', '@bob, ok')
  })

  it('ответ на корневой комментарий: parentid = answerid = его id', async () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'yo'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'c1', 'yo')
    // В уведомлении об этом комментарии — «Вы ответили».
    expect(notificationsStore.markAnswered).toHaveBeenCalledWith('c1')
  })

  it('корневой комментарий к посту: parentid и answerid пустые', async () => {
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'root'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', '', '', 'root')
    expect(notificationsStore.markAnswered).not.toHaveBeenCalled()
  })

  it('ошибка отправки: pending снимается, черновик и цель возвращаются', async () => {
    sendComment.mockRejectedValueOnce(new Error('node'))
    const { api } = form()
    api.onReplyToSecondLevel(reply)
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(commentsStore.removePending).toHaveBeenCalled()
    expect(api.replyDraft.value).toBe('hi')
    expect(api.replyTarget.value).toEqual({ commentId: 'r1', parentId: 'c1', prefix: '' })
    expect(toast.error).toHaveBeenCalledWith({ message: 'node' })
    // Ответ не ушёл — и отметки нет.
    expect(notificationsStore.markAnswered).not.toHaveBeenCalled()
  })

  it('«ответить автору» корневого комментария: префикс @ник, parentid = answerid = его id', async () => {
    const { api } = form()
    api.onReplyToAuthorFirstLevel(root)
    expect(api.replyDraft.value).toBe('@alice, ')
    api.replyDraft.value = '@alice, да'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'c1', '@alice, да')
  })
})

describe('sendReply — проверки перед отправкой', () => {
  it('пустой или из пробелов текст не отправляется', async () => {
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = '   \n '
    await api.sendReply()
    expect(sendComment).not.toHaveBeenCalled()
    expect(commentsStore.addPending).not.toHaveBeenCalled()
  })

  it('слишком длинный — тост «слишком длинно», ничего не уходит', async () => {
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'x'.repeat(COMMENT_MAX_LENGTH + 1)
    expect(api.rootLengthValid.value).toBe(false)
    expect(api.rootLengthHint.value?.isOver).toBe(true)
    await api.sendReply()
    expect(toast.error).toHaveBeenCalledWith({ message: 'commentsMsg.tooLong' })
    expect(sendComment).not.toHaveBeenCalled()
  })

  it('комментировать нельзя (бан, лимит…) — тост с причиной, ничего не уходит', async () => {
    const { api } = form({ disableReason: { kind: 'banned', message: 'Вы забанены' } })
    api.openReplyToPost()
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(toast.error).toHaveBeenCalledWith({ message: 'Вы забанены' })
    expect(sendComment).not.toHaveBeenCalled()
    expect(api.replyDraft.value).toBe('hi')
  })

  it('повторная отправка, пока первая в пути, игнорируется', async () => {
    let finish!: (txid: string) => void
    sendComment.mockImplementationOnce(() => new Promise<string>((r) => (finish = r)))
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'раз'
    const first = api.sendReply()
    expect(api.replySubmitting.value).toBe(true)
    // Пока первая не завершилась, пользователь набрал и снова жмёт «отправить».
    api.replyDraft.value = 'два'
    await api.sendReply()
    finish('TX1')
    await first
    expect(sendComment).toHaveBeenCalledTimes(1)
    expect(api.replySubmitting.value).toBe(false)
  })
})

describe('sendReply — корневой комментарий', () => {
  it('раскрывает свёрнутый список и показывает минимум страницу', async () => {
    const ctx = form({ allComments: null, commentsCollapsed: true, visibleCommentsCount: 1 })
    ctx.api.openReplyToPost()
    ctx.api.replyDraft.value = 'hi'
    await ctx.api.sendReply()
    expect(ctx.allComments.value).toEqual([])
    expect(ctx.commentsCollapsed.value).toBe(false)
    expect(ctx.visibleCommentsCount.value).toBe(COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE)
    expect(ctx.emitComment).toHaveBeenCalledTimes(1)
    expect(ctx.refreshAllComments).toHaveBeenCalledTimes(1)
  })

  it('уже показанное больше страницы — счётчик не уменьшается', async () => {
    const ctx = form({ visibleCommentsCount: 100 })
    ctx.api.openReplyToPost()
    ctx.api.replyDraft.value = 'hi'
    await ctx.api.sendReply()
    expect(ctx.visibleCommentsCount.value).toBe(100)
  })

  it('форма закрывается сразу, до ответа ноды; успех — тост', async () => {
    let finish!: (txid: string) => void
    sendComment.mockImplementationOnce(() => new Promise<string>((r) => (finish = r)))
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'hi'
    const sending = api.sendReply()
    expect(api.replyTarget.value).toBeNull()
    expect(api.replyDraft.value).toBe('')
    finish('TX')
    await sending
    expect(toast.success).toHaveBeenCalledWith({ message: 'commentsMsg.sendSuccess' })
  })

  it('сбой обновления списка после отправки не превращает успех в ошибку', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api } = form({ refreshAllComments: async () => Promise.reject(new Error('net')) })
    api.openReplyToPost()
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('нода не вернула txid — временный id не подменяется', async () => {
    sendComment.mockResolvedValueOnce('')
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(commentsStore.replacePendingId).not.toHaveBeenCalled()
  })

  it('ответ на ветку не трогает список корневых и не перезапрашивает его', async () => {
    const ctx = form({ commentsCollapsed: true })
    ctx.api.onReplyToFirstLevel(root)
    ctx.api.replyDraft.value = 'hi'
    await ctx.api.sendReply()
    expect(ctx.commentsCollapsed.value).toBe(true)
    expect(ctx.refreshAllComments).not.toHaveBeenCalled()
  })

  it('ошибка из корневой формы без явной цели возвращает корневую форму и текст', async () => {
    sendComment.mockRejectedValueOnce('строка вместо Error')
    const { api } = form()
    // replyTarget === null — активна корневая форма-бар.
    api.replyDraft.value = 'текст'
    await api.sendReply()
    expect(api.replyTarget.value).toEqual({ commentId: 'root', parentId: '', prefix: '' })
    expect(api.replyDraft.value).toBe('текст')
    expect(toast.error).toHaveBeenCalledWith({ message: 'commentsMsg.sendError' })
  })
})

describe('черновик корневой формы', () => {
  it('восстанавливается при создании формы', () => {
    localStorage.setItem(commentDraftKey('ME', 'POST'), 'недописанное')
    const { api } = form()
    expect(api.replyDraft.value).toBe('недописанное')
    expect(api.isRootReplyActive.value).toBe(true)
  })

  it('ввод в корневую форму сохраняется, открытие формы к посту его возвращает', () => {
    const { api } = form()
    api.handleRootReplyInput(inputEvent('черновик'))
    expect(savedDraft()).toBe('черновик')
    api.onReplyToFirstLevel(root)
    expect(api.replyDraft.value).toBe('')
    api.openReplyToPost()
    expect(api.replyDraft.value).toBe('черновик')
  })

  it('пока открыт ответ на ветку, ввод в корневую форму игнорируется', () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'ответ ветке'
    api.handleRootReplyInput(inputEvent('чужое'))
    expect(api.replyDraft.value).toBe('ответ ветке')
    expect(savedDraft()).toBeNull()
  })

  it('успешная отправка стирает черновик, неудачная — оставляет', async () => {
    const { api } = form()
    api.handleRootReplyInput(inputEvent('первый'))
    sendComment.mockRejectedValueOnce(new Error('node'))
    await api.sendReply()
    expect(savedDraft()).toBe('первый')
    await api.sendReply()
    expect(savedDraft()).toBeNull()
  })

  it('подтверждённая отмена стирает черновик и закрывает форму', () => {
    const { api } = form()
    api.handleRootReplyInput(inputEvent('черновик'))
    api.confirmCancelReply()
    expect(savedDraft()).toBeNull()
    expect(api.replyTarget.value).toBeNull()
    expect(api.replyDraft.value).toBe('')
  })
})

describe('смена цели ответа', () => {
  it('ключ панели и признак открытой панели следуют за целью', () => {
    const { api } = form()
    expect(api.replyPanelKey.value).toBe('closed')
    api.onReplyToAuthorFirstLevel(root)
    expect(api.replyPanelKey.value).toBe('c1:author')
    expect(api.isReplyPanelOpen('c1')).toBe(true)
    expect(api.isReplyPanelOpen('r1')).toBe(false)
    expect(api.isRootReplyActive.value).toBe(false)
    api.onReplyToFirstLevel(root)
    expect(api.replyPanelKey.value).toBe('c1:empty')
  })

  it('повторное «ответить автору» не дублирует префикс, а дописывает его к тексту без префикса', () => {
    const { api } = form()
    api.onReplyToAuthorFirstLevel(root)
    api.replyDraft.value = '@alice, привет'
    api.onReplyToAuthorFirstLevel(root)
    expect(api.replyDraft.value).toBe('@alice, привет')

    api.onReplyToFirstLevel(root)
    expect(api.replyDraft.value).toBe('привет')
    api.onReplyToAuthorFirstLevel(root)
    expect(api.replyDraft.value).toBe('@alice, привет')
  })

  it('переход к другому комментарию начинает ответ с чистого листа', () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'для c1'
    api.onReplyToSecondLevel(reply)
    expect(api.replyDraft.value).toBe('')
    api.replyDraft.value = 'для r1'
    api.onReplyToAuthorFirstLevel(root)
    expect(api.replyDraft.value).toBe('@alice, ')
  })

  it('у ответа без parentid корнем ветки считается он сам', async () => {
    const { api } = form()
    api.onReplyToSecondLevel({ id: 'x1', parentid: '', address: 'C', userprofile: {} } as never)
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'x1', 'x1', 'hi')
  })

  it('закрытие: только префикс или пусто — сразу, есть текст — переспрашивает', () => {
    const { api } = form()
    api.onReplyToAuthorFirstLevel(root)
    api.requestCloseReply()
    expect(api.replyTarget.value).toBeNull()
    expect(api.showCancelReplyModal.value).toBe(false)

    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'важный ответ'
    api.requestCloseReply()
    expect(api.showCancelReplyModal.value).toBe(true)
    expect(api.replyTarget.value).not.toBeNull()
    expect(api.replyDraft.value).toBe('важный ответ')
  })

  it('фокус на корневом баре при открытом ответе ветке переключает на корневую форму', () => {
    localStorage.setItem(commentDraftKey('ME', 'POST'), 'корневой черновик')
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.onRootBarFocus()
    expect(api.replyTarget.value).toEqual({ commentId: 'root', parentId: '', prefix: '' })
    expect(api.replyDraft.value).toBe('корневой черновик')
    // Уже в корневой форме — повторный фокус ничего не сбрасывает.
    api.replyDraft.value = 'дописываю'
    api.onRootBarFocus()
    expect(api.replyDraft.value).toBe('дописываю')
  })
})

describe('@-упоминания', () => {
  const users: MentionUser[] = [
    { address: 'A1', name: 'alice' },
    { address: 'A2', name: 'alex' },
    { address: 'A3', name: 'albert' },
  ]

  it('«@» перед курсором открывает список с запросом после него', () => {
    const { api } = form()
    api.handleReplyInput(inputEvent('привет @al'))
    expect(api.showMentionList.value).toBe(true)
    expect(api.mentionQuery.value).toBe('al')
    expect(api.mentionStartOffset.value).toBe(7)
    expect(api.mentionEndOffset.value).toBe(10)
  })

  it('учитывается позиция курсора, а не конец текста', () => {
    const { api } = form()
    api.handleReplyInput(inputEvent('@bo и дальше', 3))
    expect(api.mentionQuery.value).toBe('bo')
    expect(api.showMentionList.value).toBe(true)
  })

  it('пробел после «@…» или отсутствие «@» закрывают список', () => {
    const { api } = form()
    api.handleReplyInput(inputEvent('@al'))
    api.handleReplyInput(inputEvent('@al ice'))
    expect(api.showMentionList.value).toBe(false)
    api.handleReplyInput(inputEvent('@al'))
    api.handleReplyInput(inputEvent('без собаки'))
    expect(api.showMentionList.value).toBe(false)
    expect(api.mentionQuery.value).toBe('')
  })

  it('выбор подставляет «@ник » на место набранного и сохраняет текст после', async () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const { api } = form({ rootTextarea: textarea })
    api.replyDraft.value = 'привет @al, как дела'
    api.handleReplyInput(inputEvent('привет @al, как дела', 10))
    api.selectMentionUser(users[0]!)
    expect(api.replyDraft.value).toBe('привет @alice , как дела')
    expect(api.showMentionList.value).toBe(false)
    expect(api.mentionQuery.value).toBe('')
    // В компоненте textarea связана v-model — повторяем это синхронно.
    textarea.value = api.replyDraft.value
    await nextTick()
    // Курсор — сразу за вставленным ником.
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe('привет @alice '.length)
    textarea.remove()
  })

  it('стрелки двигают подсветку в границах списка, Enter выбирает, Escape закрывает', () => {
    const { api } = form({ mentionUsers: users })
    api.replyDraft.value = '@al'
    api.handleReplyInput(inputEvent('@al'))

    const down = keydown('ArrowDown')
    api.handleReplyKeydown(down.event)
    api.handleReplyKeydown(keydown('ArrowDown').event)
    api.handleReplyKeydown(keydown('ArrowDown').event)
    expect(api.mentionHighlightIndex.value).toBe(2)
    expect(down.preventDefault).toHaveBeenCalled()

    api.handleReplyKeydown(keydown('ArrowUp').event)
    api.handleReplyKeydown(keydown('ArrowUp').event)
    api.handleReplyKeydown(keydown('ArrowUp').event)
    expect(api.mentionHighlightIndex.value).toBe(0)

    api.handleReplyKeydown(keydown('ArrowDown').event)
    const enter = keydown('Enter')
    api.handleReplyKeydown(enter.event)
    expect(api.replyDraft.value).toBe('@alex ')
    expect(enter.preventDefault).toHaveBeenCalled()

    api.handleReplyInput(inputEvent('@alex @a'))
    const esc = keydown('Escape')
    api.handleReplyKeydown(esc.event)
    expect(api.showMentionList.value).toBe(false)
    expect(esc.preventDefault).toHaveBeenCalled()
  })

  it('подсвеченный пункт прокручивается в зону видимости списка', async () => {
    const list = document.createElement('div')
    Object.defineProperty(list, 'clientHeight', { value: 100 })
    const items = users.map(() => {
      const li = document.createElement('div')
      li.scrollIntoView = vi.fn()
      list.appendChild(li)
      return li
    })
    const repliesExpanded = ref<Record<string, boolean>>({})
    const api = useCommentForm({
      postId: ref('POST'),
      currentUserAddress: ref('ME'),
      composerDisableReason: ref(null),
      allComments: ref([]),
      visibleCommentsCount: ref(0),
      commentsCollapsed: ref(false),
      repliesExpanded,
      refreshAllComments: async () => {},
      emitComment: () => {},
      // Список корневой формы приходит компонентом (у него есть $el).
      rootMentionListRef: ref({ $el: list }),
      mentionListRef: ref(null),
      rootReplyTextareaRef: ref(null),
      replyTextareaRef: ref(null),
      filteredMentionUsers: computed(() => users),
    })
    api.handleReplyInput(inputEvent('@al'))
    api.handleReplyKeydown(keydown('ArrowDown').event)
    await vi.waitFor(() => expect(items[1]!.scrollIntoView).toHaveBeenCalled())
    expect(items[0]!.scrollIntoView).not.toHaveBeenCalled()
  })

  it('без открытого списка или без совпадений клавиши не перехватываются', () => {
    const { api } = form({ mentionUsers: [] })
    api.handleReplyInput(inputEvent('@zz'))
    const enter = keydown('Enter')
    api.handleReplyKeydown(enter.event)
    expect(enter.preventDefault).not.toHaveBeenCalled()
    expect(api.showMentionList.value).toBe(true)
  })
})

describe('Ctrl/Cmd+Enter', () => {
  it('отправляет ответ, если есть текст и открыта форма', async () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'быстро'
    const ev = keydown('Enter', { ctrlKey: true })
    api.handleReplyKeydown(ev.event)
    expect(ev.preventDefault).toHaveBeenCalled()
    await vi.waitFor(() => expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'c1', 'быстро'))
  })

  it('с пустым текстом или без открытой формы ничего не отправляет', () => {
    const { api } = form()
    api.replyDraft.value = 'текст без цели'
    api.handleReplyKeydown(keydown('Enter', { metaKey: true }).event)
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = '  '
    api.handleReplyKeydown(keydown('Enter', { metaKey: true }).event)
    expect(sendComment).not.toHaveBeenCalled()
  })
})

describe('эмодзи в корневую форму', () => {
  it('вставляется на место выделения и сохраняется в черновик', async () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.value = 'привет мир'
    textarea.setSelectionRange(7, 10)
    const { api } = form({ rootTextarea: textarea })
    api.replyDraft.value = 'привет мир'
    api.insertRootEmoji('🙂')
    expect(api.replyDraft.value).toBe('привет 🙂')
    expect(savedDraft()).toBe('привет 🙂')
    await nextTick()
    expect(document.activeElement).toBe(textarea)
    textarea.remove()
  })

  it('без textarea — дописывается в конец', () => {
    const { api } = form()
    api.replyDraft.value = 'ок'
    api.insertRootEmoji('👍')
    expect(api.replyDraft.value).toBe('ок👍')
  })

  it('при открытом ответе ветке вставляется, но в черновик поста не пишется', () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.insertRootEmoji('👍')
    expect(api.replyDraft.value).toBe('👍')
    expect(savedDraft()).toBeNull()
  })
})
