// Фильтры вкладки «Видео» профиля: поиск, порядок и тема — из адреса и в
// адрес (replace, прочие параметры на месте); темы — самые частые метки
// роликов, пока выдача не отфильтрована.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import type { AdaptedPost } from '@/types/adapted-post'

const r = vi.hoisted(() => ({
  route: { query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => r.route,
  useRouter: () => ({ replace: r.replace }),
}))

import { TOP_TAGS, useProfileVideoFilters, useTopTags } from './use-profile-video-filters'

const run = <T>(fn: () => T): T => effectScope().run(fn)!

beforeEach(() => {
  r.route = reactive({ query: { tab: 'video' } as Record<string, unknown> })
  r.replace.mockReset()
  r.replace.mockImplementation(({ query }: { query: Record<string, unknown> }) => {
    r.route.query = query
  })
})

describe('useProfileVideoFilters', () => {
  it('по умолчанию — «Новые», без поиска и темы', () => {
    const f = run(() => useProfileVideoFilters())
    expect(f.order.value).toBe('new')
    expect(f.query.value).toBe('')
    expect(f.tag.value).toBe('')
    expect(f.tags.value).toEqual([])
  })

  it('из адреса: порядок, тема без # и в нижнем регистре, слова без пробелов по краям', () => {
    r.route.query = { tab: 'video', sort: 'old', tag: '#Music', q: '  котики ' }
    const f = run(() => useProfileVideoFilters())
    expect(f.order.value).toBe('old')
    expect(f.tag.value).toBe('music')
    expect(f.tags.value).toEqual(['music'])
    expect(f.query.value).toBe('котики')
  })

  it('неизвестный порядок в адресе — «Новые»', () => {
    r.route.query = { tab: 'video', sort: 'random' }
    expect(run(() => useProfileVideoFilters()).order.value).toBe('new')
  })

  it('смена — replace, вкладка остаётся; «Новые» и пустое убираются из адреса', () => {
    const f = run(() => useProfileVideoFilters())
    f.setOrder('popular')
    expect(r.replace).toHaveBeenLastCalledWith({ query: { tab: 'video', sort: 'popular' } })
    f.setTag('music')
    expect(r.route.query).toEqual({ tab: 'video', sort: 'popular', tag: 'music' })
    f.setOrder('new')
    f.setTag('')
    expect(r.route.query).toEqual({ tab: 'video' })
    f.setQuery('  котики ')
    expect(r.route.query).toEqual({ tab: 'video', q: 'котики' })
    f.setQuery(' ')
    expect(r.route.query).toEqual({ tab: 'video' })
  })
})

describe('useTopTags', () => {
  const post = (txid: string, tags: string[]): AdaptedPost => ({ txid, tags }) as AdaptedPost

  it('самые частые сначала, при равенстве — по алфавиту; ролик считается один раз', async () => {
    const posts = ref<AdaptedPost[]>([post('a', ['live', 'Music']), post('b', ['music', 'jazz'])])
    const top = run(() =>
      useTopTags(
        posts,
        () => false,
        () => ''
      )
    )
    expect(top.value).toEqual(['music', 'jazz', 'live'])
    // Подгрузили страницу: прежние ролики не считаются второй раз.
    posts.value = [...posts.value, post('c', ['jazz']), post('d', ['jazz', 'jazz'])]
    await nextTick()
    expect(top.value).toEqual(['jazz', 'music', 'live'])
  })

  it('пока выдача отфильтрована — не считает; выбранная тема в списке всегда', async () => {
    const filtered = ref(false)
    const selected = ref('')
    const posts = ref<AdaptedPost[]>([post('a', ['live'])])
    const top = run(() =>
      useTopTags(
        posts,
        () => filtered.value,
        () => selected.value
      )
    )
    filtered.value = true
    selected.value = 'rare'
    posts.value = [post('b', ['rare', 'only-in-filter'])]
    await nextTick()
    expect(top.value).toEqual(['rare', 'live'])
  })

  it(`не больше ${TOP_TAGS} тем`, () => {
    const many = Array.from({ length: TOP_TAGS + 5 }, (_, i) => post(`p${i}`, [`t${i}`]))
    const top = run(() =>
      useTopTags(
        ref(many),
        () => false,
        () => ''
      )
    )
    expect(top.value).toHaveLength(TOP_TAGS)
  })
})
