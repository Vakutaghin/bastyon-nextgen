// Переносы строк в комментарии: в msg — обычные \n, на экране — отдельные строки
// (раньше HTML склеивал ответ в одну строку). Плюс счётчик длины, разбор msg,
// аватары/ссылки и рейтинг «интересных» (1:1 с legacy commentPoint).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { setI18nLocale } from '@/i18n'
import {
  commentPoint,
  compressedNumber,
  formatCommentMessageHtml,
  getCommentAvatarUrl,
  getCommentImages,
  getCommentLengthHint,
  getCommentMessageText,
  getCommentProfileLink,
  getCommentTxState,
  getInitial,
  isCommentLengthValid,
  sortComments,
} from './helpers'
import { COMMENT_LENGTH_WARN_THRESHOLD, COMMENT_MAX_LENGTH } from './consts'

const comment = (message: string): GetComment =>
  ({ msg: JSON.stringify({ message, url: '', images: [], info: '' }) }) as GetComment

describe('formatCommentMessageHtml', () => {
  it('\\n и \\r\\n становятся <br>, пустая строка между абзацами сохраняется', () => {
    expect(formatCommentMessageHtml(comment('раз\nдва\r\n\nтри'))).toBe('раз<br>два<br><br>три')
  })

  it('крайние переносы не дают пустых строк', () => {
    expect(formatCommentMessageHtml(comment('\n\nпривет\n'))).toBe('привет')
  })

  it('ссылки и меншены на соседних строках остаются ссылками', () => {
    const html = formatCommentMessageHtml(comment('@bob,\nсмотри https://example.com'))
    expect(html).toContain('<br>')
    expect(html).toContain('class="mention-link"')
    expect(html).toContain('href="https://example.com"')
  })

  it('разметка в тексте по-прежнему проходит санитайзер', () => {
    const html = formatCommentMessageHtml(comment('строка\n<img src=x onerror=alert(1)>'))
    expect(html).not.toContain('onerror')
  })
})

/** Комментарий с разумными значениями по умолчанию: оценки и дети — нули. */
const full = (over: Partial<GetComment> = {}): GetComment =>
  ({
    id: 'c',
    postid: 'p',
    address: 'PAddr',
    time: 1000,
    msg: JSON.stringify({ message: 'x'.repeat(10), url: '', images: [], info: '' }),
    scoreUp: 0,
    scoreDown: 0,
    children: 0,
    reputation: 0,
    deleted: false,
    userprofile: { name: 'Alice', i: '' },
    ...over,
  }) as GetComment

describe('getCommentLengthHint / isCommentLengthValid', () => {
  beforeAll(() => setI18nLocale('en'))
  afterAll(() => setI18nLocale('ru'))

  it('пока до лимита далеко — счётчик скрыт', () => {
    expect(getCommentLengthHint('')).toBeNull()
    expect(
      getCommentLengthHint('x'.repeat(COMMENT_MAX_LENGTH - COMMENT_LENGTH_WARN_THRESHOLD))
    ).toBeNull()
  })

  it('ближе порога — показывает, сколько осталось, без «превышения»', () => {
    expect(getCommentLengthHint('x'.repeat(COMMENT_MAX_LENGTH - 7))).toEqual({
      text: '7 characters left',
      isOver: false,
    })
    expect(getCommentLengthHint('x'.repeat(COMMENT_MAX_LENGTH - 1))?.isOver).toBe(false)
  })

  it('сверх лимита — показывает перебор и помечает его', () => {
    expect(getCommentLengthHint('x'.repeat(COMMENT_MAX_LENGTH + 1))).toEqual({
      text: '1 character over the limit',
      isOver: true,
    })
  })

  it('отправлять можно до лимита включительно', () => {
    expect(isCommentLengthValid('x'.repeat(COMMENT_MAX_LENGTH))).toBe(true)
    expect(isCommentLengthValid('x'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(false)
    expect(isCommentLengthValid(undefined as unknown as string)).toBe(true)
  })
})

describe('compressedNumber', () => {
  it('ноль и нечисла — пустая подпись', () => {
    expect(compressedNumber(0)).toBe('')
    expect(compressedNumber(NaN)).toBe('')
    expect(compressedNumber(Infinity)).toBe('')
  })

  it('до тысячи — как есть, со знаком', () => {
    expect(compressedNumber(999)).toBe('999')
    expect(compressedNumber(-5)).toBe('-5')
  })

  it('тысячи, миллионы, миллиарды — с суффиксом и без хвостовых нулей', () => {
    expect(compressedNumber(1000)).toBe('1K')
    expect(compressedNumber(1234)).toBe('1.2K')
    expect(compressedNumber(-1500)).toBe('-1.5K')
    expect(compressedNumber(2_000_000)).toBe('2M')
    expect(compressedNumber(1_250_000, 2)).toBe('1.25M')
    expect(compressedNumber(3_100_000_000)).toBe('3.1B')
  })
})

describe('getCommentTxState', () => {
  it('отклонённый сетью важнее «в пути», подтверждённый — обычный', () => {
    expect(getCommentTxState(full({ rejected: true, temp: true }))).toBe('rejected')
    expect(getCommentTxState(full({ temp: true }))).toBe('pending')
    expect(getCommentTxState(full({ relay: true }))).toBe('pending')
    expect(getCommentTxState(full())).toBe('normal')
  })
})

describe('getCommentMessageText / getCommentImages', () => {
  it('из JSON берёт message, старый msg-текст отдаёт как есть', () => {
    expect(getCommentMessageText(comment('привет'))).toBe('привет')
    expect(getCommentMessageText(full({ msg: 'просто текст' }))).toBe('просто текст')
    // JSON без message — показывается исходная строка, а не undefined.
    expect(getCommentMessageText(full({ msg: '{"images":[]}' }))).toBe('{"images":[]}')
  })

  it('картинки: хеш → полный адрес, закодированные адреса раскодируются, мусор отброшен', () => {
    const msg = JSON.stringify({
      message: '',
      images: [
        'abc123',
        encodeURIComponent('https://img.example/a b.png'),
        '',
        42,
        null,
        'https://bastyon.com:8092/i/old',
      ],
    })
    expect(getCommentImages(full({ msg }))).toEqual([
      'https://pocketnet.app:8092/i/abc123',
      'https://img.example/a b.png',
      'https://pocketnet.app:8092/i/old',
    ])
  })

  it('нет картинок, не массив или msg не JSON — пустой список', () => {
    expect(getCommentImages(full({ msg: '{"images":"x"}' }))).toEqual([])
    expect(getCommentImages(full({ msg: '{"images":[]}' }))).toEqual([])
    expect(getCommentImages(full({ msg: 'не json' }))).toEqual([])
    expect(getCommentImages(full({ msg: 'null' }))).toEqual([])
  })
})

describe('аватар, ссылка на профиль, инициал', () => {
  it('аватар из хеша достраивается до адреса, без аватара — null', () => {
    expect(getCommentAvatarUrl({ i: 'hash1' } as GetComment['userprofile'])).toBe(
      'https://pocketnet.app:8092/i/hash1'
    )
    expect(getCommentAvatarUrl({ i: '' } as GetComment['userprofile'])).toBeNull()
    expect(getCommentAvatarUrl(undefined as unknown as GetComment['userprofile'])).toBeNull()
  })

  it('ссылка на профиль — по адресу, без адреса — по нику в нижнем регистре', () => {
    expect(getCommentProfileLink(full({ address: 'PAddr' }))).toBe('/PAddr')
    expect(
      getCommentProfileLink(
        full({ address: '', userprofile: { name: 'Alice' } as GetComment['userprofile'] })
      )
    ).toBe('/alice')
    expect(
      getCommentProfileLink(
        full({ address: '', userprofile: undefined as unknown as GetComment['userprofile'] })
      )
    ).toBe('/')
  })

  it('инициал — первая буква в верхнем регистре, без имени — «?»', () => {
    expect(getInitial('alice')).toBe('A')
    expect(getInitial('ж')).toBe('Ж')
    expect(getInitial('')).toBe('?')
    expect(getInitial()).toBe('?')
  })
})

describe('commentPoint — рейтинг для «интересных»', () => {
  it('базовый расчёт совпадает с legacy commentPoint', () => {
    // 2·250 + 1·450 + 1·50 (лайков больше) + 10·3 + max(0,100)·10 + 0/20
    expect(commentPoint(full({ scoreUp: 2, scoreDown: 1, children: 1 }))).toBe(2030)
  })

  it('дизлайков не меньше лайков — дизлайки штрафуют, а не добавляют', () => {
    const balanced = commentPoint(full({ scoreUp: 1, scoreDown: 1 }))
    const positive = commentPoint(full({ scoreUp: 2, scoreDown: 1 }))
    expect(positive - balanced).toBeGreaterThan(250)
    expect(commentPoint(full({ scoreDown: 2 }))).toBeLessThan(commentPoint(full()))
  })

  it('длина сообщения учитывается только до 200 символов', () => {
    const msg = (n: number) => JSON.stringify({ message: 'x'.repeat(n) })
    expect(commentPoint(full({ msg: msg(200) }))).toBe(commentPoint(full({ msg: msg(5000) })))
    expect(commentPoint(full({ msg: msg(100) }))).toBeLessThan(
      commentPoint(full({ msg: msg(200) }))
    )
  })

  it('донат поднимает комментарий, мусорная сумма — нет', () => {
    const base = commentPoint(full())
    const withAmount = (amount: unknown) => full({ amount } as unknown as Partial<GetComment>)
    expect(commentPoint(withAmount(100_000_000))).toBe(base + 1000)
    expect(commentPoint(withAmount(-5))).toBe(base)
    expect(commentPoint(withAmount('много'))).toBe(base)
  })

  it('удалённый комментарий почти обнуляется', () => {
    expect(commentPoint(full({ deleted: true }))).toBeCloseTo(commentPoint(full()) / 1300)
  })

  it('verified сильнее, чем «свой», «свой» сильнее обычного', () => {
    const base = commentPoint(full())
    expect(commentPoint(full(), { isVerified: () => true, myAddress: 'PAddr' })).toBe(base * 1000)
    expect(commentPoint(full(), { myAddress: 'PAddr' })).toBe(base * 20)
  })

  it('ответы к своему комментарию весят в 10 раз больше', () => {
    const others = commentPoint(full({ children: 1 })) - commentPoint(full())
    const mine =
      (commentPoint(full({ children: 1 }), { myAddress: 'PAddr' }) -
        commentPoint(full(), { myAddress: 'PAddr' })) /
      20
    expect(mine).toBe(others * 10)
  })

  it('заблокированный автор уходит в ноль, но собственный комментарий — нет', () => {
    const isBlocked = () => true
    expect(commentPoint(full({ scoreUp: 10 }), { isBlocked })).toBe(0)
    expect(commentPoint(full(), { isBlocked, myAddress: 'PAddr' })).toBeGreaterThan(0)
  })

  it('комментарий автора поста — ×50', () => {
    expect(commentPoint(full(), { postAuthorAddress: 'PAddr' })).toBe(commentPoint(full()) * 50)
    expect(commentPoint(full(), { postAuthorAddress: 'POther' })).toBe(commentPoint(full()))
  })

  it('очки активности прибавляются только чужим и только положительные', () => {
    const base = commentPoint(full())
    expect(commentPoint(full(), { getActivityPoint: () => 3 })).toBe(base + 30)
    expect(commentPoint(full(), { getActivityPoint: () => -3 })).toBe(base)
    expect(commentPoint(full(), { getActivityPoint: () => 3, myAddress: 'PAddr' })).toBe(base * 20)
  })
})

describe('sortComments', () => {
  const a = full({ id: 'a', address: 'A', time: 300 })
  const b = full({ id: 'b', address: 'B', time: 100 })
  const c = full({ id: 'c', address: 'C', time: 200 })

  it('старые / новые — по времени, исходный массив не меняется', () => {
    const input = [a, b, c]
    expect(sortComments(input, 'oldest').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(sortComments(input, 'newest').map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(input.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('пустой список возвращается как есть', () => {
    const empty: GetComment[] = []
    expect(sortComments(empty, 'interesting')).toBe(empty)
  })

  it('«интересные»: залайканный выше свежего, при равенстве — свежий выше', () => {
    const liked = full({ id: 'liked', address: 'L', time: 100, scoreUp: 20 })
    const fresh = full({ id: 'fresh', address: 'F', time: 300 })
    const mid = full({ id: 'mid', address: 'M', time: 200 })
    expect(sortComments([fresh, mid, liked], 'interesting').map((x) => x.id)).toEqual([
      'liked',
      'fresh',
      'mid',
    ])
  })

  it('«интересные»: много комментариев одного автора делят его вес', () => {
    const spam1 = full({ id: 's1', address: 'S', time: 100, scoreUp: 3 })
    const spam2 = full({ id: 's2', address: 'S', time: 100, scoreUp: 3 })
    const solo = full({ id: 'solo', address: 'O', time: 100, scoreUp: 3 })
    expect(sortComments([spam1, spam2, solo], 'interesting')[0]?.id).toBe('solo')
  })

  it('«интересные»: контекст влияет — заблокированный автор опускается вниз', () => {
    const top = full({ id: 'top', address: 'BAD', time: 100, scoreUp: 50 })
    const low = full({ id: 'low', address: 'OK', time: 100 })
    const sorted = sortComments([top, low], 'interesting', { isBlocked: (x) => x === 'BAD' })
    expect(sorted.map((x) => x.id)).toEqual(['low', 'top'])
  })
})
