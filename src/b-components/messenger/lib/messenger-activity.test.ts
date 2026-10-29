// Значок «догружается» в шапке мессенджера: пока входит в Matrix, пока список
// из кэша ждёт ответа сервера, пока нет связи и пока грузятся сообщения чата.

import { describe, expect, it } from 'vitest'

import { chatActivityOf, listActivityOf, type ListActivityState } from './messenger-activity'

const state = (over: Partial<ListActivityState> = {}): ListActivityState => ({
  authenticated: true,
  syncError: null,
  syncState: 'SYNCING',
  dialogsLoading: false,
  ...over,
})

describe('listActivityOf', () => {
  it('сервер ответил, список готов — значка нет', () => {
    expect(listActivityOf(state())).toBeNull()
  })

  it('вход в Matrix — «Подключаюсь»', () => {
    expect(listActivityOf(state({ syncState: 'STOPPED' }))).toBe('connecting')
  })

  it('список из кэша, сервер ещё не ответил, и догон после обрыва — «Обновляю»', () => {
    expect(listActivityOf(state({ syncState: 'PREPARED' }))).toBe('updating')
    expect(listActivityOf(state({ syncState: 'CATCHUP' }))).toBe('updating')
    expect(listActivityOf(state({ dialogsLoading: true }))).toBe('updating')
  })

  it('нет связи — «Переподключаюсь»', () => {
    expect(listActivityOf(state({ syncState: 'RECONNECTING' }))).toBe('reconnecting')
  })

  it('красная полоса ошибки или гость — значка нет', () => {
    expect(listActivityOf(state({ syncState: 'ERROR', syncError: 'нет связи' }))).toBeNull()
    expect(listActivityOf(state({ syncState: 'STOPPED', authenticated: false }))).toBeNull()
  })
})

describe('chatActivityOf', () => {
  it('сообщения чата грузятся — это и показываем; иначе — что со списком', () => {
    expect(chatActivityOf(null, true)).toBe('messages')
    expect(chatActivityOf('updating', true)).toBe('messages')
    expect(chatActivityOf('updating', false)).toBe('updating')
    expect(chatActivityOf(null, false)).toBeNull()
  })
})
