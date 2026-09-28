// Черновик комментария к посту: ключ по аккаунту и посту (N10), старый ключ
// без адреса переезжает к первому прочитавшему аккаунту, пустой текст
// удаляет черновик, а недоступный localStorage не роняет форму.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCommentDraft,
  commentDraftKey,
  readCommentDraft,
  writeCommentDraft,
} from './comment-draft-storage'

describe('comment-draft-storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('черновики разных аккаунтов и постов не смешиваются', () => {
    writeCommentDraft('PA', 'post1', 'текст A')
    writeCommentDraft('PB', 'post1', 'текст B')
    writeCommentDraft('PA', 'post2', 'другой пост')
    expect(readCommentDraft('PA', 'post1')).toBe('текст A')
    expect(readCommentDraft('PB', 'post1')).toBe('текст B')
    expect(readCommentDraft('PA', 'post2')).toBe('другой пост')
    expect(commentDraftKey('PA', 'post1')).toBe('bastyon_comment_draft:PA:post1')
  })

  it('старый черновик без адреса переезжает к первому аккаунту и больше никому не достаётся', () => {
    localStorage.setItem('bastyon_comment_draft:post1', 'старый')
    expect(readCommentDraft('PA', 'post1')).toBe('старый')
    expect(localStorage.getItem('bastyon_comment_draft:post1')).toBeNull()
    expect(readCommentDraft('PB', 'post1')).toBe('')
  })

  it('свой черновик не затирается старым общим', () => {
    writeCommentDraft('PA', 'post1', 'мой')
    localStorage.setItem('bastyon_comment_draft:post1', 'старый')
    expect(readCommentDraft('PA', 'post1')).toBe('мой')
  })

  it('пустой текст удаляет черновик, clear — тоже', () => {
    writeCommentDraft('PA', 'post1', 'текст')
    writeCommentDraft('PA', 'post1', '   ')
    expect(localStorage.getItem(commentDraftKey('PA', 'post1'))).toBeNull()

    writeCommentDraft('PA', 'post1', 'текст')
    clearCommentDraft('PA', 'post1')
    expect(readCommentDraft('PA', 'post1')).toBe('')
  })

  it('недоступный localStorage (приватный режим) не бросает', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(readCommentDraft('PA', 'post1')).toBe('')
    expect(() => writeCommentDraft('PA', 'post1', 'текст')).not.toThrow()
    expect(() => clearCommentDraft('PA', 'post1')).not.toThrow()
  })
})
