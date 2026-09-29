// Кому показывать пост с ограниченной видимостью (`s.f`): автор видит свой пост
// всегда, «для подписчиков» — только подписчики, «для зарегистрированных» —
// только вошедшие, «для платных подписчиков» — только автор: платную подписку
// это приложение проверить не может. Неизвестное значение — «для всех».

import { describe, expect, it } from 'vitest'

import { postVisibilityOf, visibilityRestriction, type PostViewer } from './post-visibility'

const AUTHOR = 'PAuthor1111111111111111111111111111'
const ME = 'PMe22222222222222222222222222222222'

const guest: PostViewer = { address: null, isSubscribedTo: () => false }
const stranger: PostViewer = { address: ME, isSubscribedTo: () => false }
const follower: PostViewer = { address: ME, isSubscribedTo: (a) => a === AUTHOR }
const author: PostViewer = { address: AUTHOR, isSubscribedTo: () => false }

describe('postVisibilityOf', () => {
  it('значения поля f старого клиента', () => {
    expect(postVisibilityOf('0')).toBe('all')
    expect(postVisibilityOf('1')).toBe('subscribers')
    expect(postVisibilityOf('2')).toBe('registered')
    expect(postVisibilityOf('3')).toBe('paid')
  })

  it('пусто, число или мусор — для всех', () => {
    expect(postVisibilityOf(undefined)).toBe('all')
    expect(postVisibilityOf(null)).toBe('all')
    expect(postVisibilityOf(1)).toBe('subscribers')
    expect(postVisibilityOf('9')).toBe('all')
  })
})

describe('visibilityRestriction', () => {
  it('пост для всех видят все', () => {
    expect(visibilityRestriction(AUTHOR, '0', guest)).toBeNull()
    expect(visibilityRestriction(AUTHOR, undefined, stranger)).toBeNull()
  })

  it('для подписчиков: подписчик видит, остальные — нет', () => {
    expect(visibilityRestriction(AUTHOR, '1', follower)).toBeNull()
    expect(visibilityRestriction(AUTHOR, '1', stranger)).toBe('subscribers')
    expect(visibilityRestriction(AUTHOR, '1', guest)).toBe('subscribers')
  })

  it('для зарегистрированных: скрыт только от гостя', () => {
    expect(visibilityRestriction(AUTHOR, '2', stranger)).toBeNull()
    expect(visibilityRestriction(AUTHOR, '2', guest)).toBe('registered')
  })

  it('для платных подписчиков: скрыт даже от подписчика', () => {
    expect(visibilityRestriction(AUTHOR, '3', follower)).toBe('paid')
    expect(visibilityRestriction(AUTHOR, '3', guest)).toBe('paid')
  })

  it('автор видит свой пост при любой видимости', () => {
    for (const f of ['1', '2', '3']) expect(visibilityRestriction(AUTHOR, f, author)).toBeNull()
  })

  it('без адреса автора пост «для подписчиков» не открывается', () => {
    expect(visibilityRestriction('', '1', follower)).toBe('subscribers')
  })
})
