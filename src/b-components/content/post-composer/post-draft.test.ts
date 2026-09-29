// Черновик поста в IndexedDB: разбор записанного (чужое и битое не
// поднимается в форму), поля и картинки отдельными ключами аккаунта,
// черновик гостя переезжает к первому вошедшему аккаунту, пустое — стирается.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => {
      store.set(key, value)
      return key
    },
    remove: async (key: string) => {
      store.delete(key)
    },
  },
}))

import {
  parseDraftFields,
  parseDraftImages,
  readStoredDraft,
  writeDraftFields,
  writeDraftImages,
  type PostDraftFields,
} from './post-draft'

const FIELDS: PostDraftFields = {
  caption: 'Заголовок',
  tags: ['море', 'лето'],
  visibility: '1',
  language: 'en',
  poll: { active: true, title: 'Куда?', options: ['Юг', 'Север'] },
  scheduledTime: 1_900_000_000,
  articleMode: false,
  articleContent: null,
  videoUrl: 'peertube://pt101.pocketnet.app/uuid',
  dismissedLinkUrl: '',
}

beforeEach(() => store.clear())

describe('parseDraftFields', () => {
  it('поля как записаны', () => {
    expect(parseDraftFields(JSON.parse(JSON.stringify(FIELDS)))).toEqual(FIELDS)
  })

  it('не объект — нет полей', () => {
    expect(parseDraftFields(null)).toBeNull()
    expect(parseDraftFields('текст')).toBeNull()
    expect(parseDraftFields([1, 2])).toBeNull()
  })

  it('битые поля становятся значениями по умолчанию, лимиты соблюдены', () => {
    const parsed = parseDraftFields({
      caption: 5,
      tags: ['a', '', 7, 'b', 'c', 'd', 'e', 'f'],
      visibility: null,
      poll: { active: 'yes', options: ['1', 2, '3', '4', '5', '6', '7'] },
      scheduledTime: Number.NaN,
      articleMode: 'true',
      articleContent: { blocks: 'нет' },
    })!
    expect(parsed.caption).toBe('')
    expect(parsed.tags).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(parsed.visibility).toBe('0')
    expect(parsed.poll).toEqual({ active: false, title: '', options: ['1', '3', '4', '5', '6'] })
    expect(parsed.scheduledTime).toBe(0)
    expect(parsed.articleMode).toBe(false)
    expect(parsed.articleContent).toBeNull()
  })

  it('статья — только с массивом blocks', () => {
    const content = { time: 1, blocks: [{ type: 'paragraph', data: { text: 'x' } }] }
    expect(
      parseDraftFields({ articleMode: true, articleContent: content })?.articleContent
    ).toEqual(content)
  })
})

describe('parseDraftImages', () => {
  it('только картинки data:image и http(s)-адреса, не больше десяти', () => {
    const png = 'data:image/png;base64,AA'
    expect(
      parseDraftImages([png, 'https://x/y.jpg', 'javascript:alert(1)', 5, 'data:text/html,x'])
    ).toEqual([png, 'https://x/y.jpg'])
    expect(parseDraftImages(Array.from({ length: 12 }, () => png))).toHaveLength(10)
    expect(parseDraftImages('png')).toEqual([])
  })
})

describe('черновик в IndexedDB', () => {
  it('поля и картинки — отдельными ключами аккаунта и возвращаются как были', async () => {
    await writeDraftFields('PA', FIELDS)
    await writeDraftImages('PA', ['data:image/png;base64,AA'])
    expect([...store.keys()].sort()).toEqual([
      'bastyon_post_draft_fields:PA',
      'bastyon_post_draft_images:PA',
    ])
    await expect(readStoredDraft('PA')).resolves.toEqual({
      fields: FIELDS,
      images: ['data:image/png;base64,AA'],
    })
    await expect(readStoredDraft('PB')).resolves.toEqual({ fields: null, images: [] })
  })

  it('пустое стирается: null вместо полей, пустой список картинок', async () => {
    await writeDraftFields('PA', FIELDS)
    await writeDraftImages('PA', ['data:image/png;base64,AA'])
    await writeDraftFields('PA', null)
    await writeDraftImages('PA', [])
    expect(store.size).toBe(0)
  })

  it('в хранилище уходят простые объекты, а не реактивные прокси', async () => {
    const { reactive } = await import('vue')
    await writeDraftFields('PA', reactive({ ...FIELDS }) as PostDraftFields)
    const saved = store.get('bastyon_post_draft_fields:PA')
    expect(saved).toEqual(FIELDS)
    expect(saved).not.toBe(FIELDS)
  })

  it('черновик гостя переезжает к первому аккаунту, который его читает', async () => {
    await writeDraftFields(null, FIELDS)
    await writeDraftImages(null, ['data:image/png;base64,AA'])
    const draft = await readStoredDraft('PA')
    expect(draft.fields).toEqual(FIELDS)
    expect(draft.images).toEqual(['data:image/png;base64,AA'])
    await expect(readStoredDraft('PB')).resolves.toEqual({ fields: null, images: [] })
  })
})
