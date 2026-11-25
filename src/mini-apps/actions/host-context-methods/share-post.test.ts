import { describe, it, expect } from 'vitest'
import { sharePostPrefill } from './share-post'

const URL = 'https://bastyon.com/application?id=barteron.pocketnet.app&p=6261'

describe('sharePostPrefill', () => {
  it('как у прежнего клиента: заголовок и текст строками, ссылка через пустую строку', () => {
    expect(
      sharePostPrefill({ title: 'Велосипед', text: { body: 'Почти новый' } }, URL, 'Barteron')
    ).toEqual({
      message: `Велосипед\nПочти новый\n\n${URL}`,
      images: [],
      tags: ['barteron'],
    })
  })

  it('без текста — только ссылка; без ссылки — только текст', () => {
    expect(sharePostPrefill(undefined, URL, '').message).toBe(URL)
    expect(sharePostPrefill({ text: { body: 'Текст' } }, '', '').message).toBe('Текст')
  })

  it('картинки: одна image или список images, только https, не больше 10', () => {
    expect(sharePostPrefill({ image: 'https://i.test/a.jpg' }, '', '').images).toEqual([
      'https://i.test/a.jpg',
    ])
    const many = Array.from({ length: 12 }, (_, i) => `https://i.test/${i}.jpg`)
    const out = sharePostPrefill({ images: ['http://i.test/x.jpg', 'data:x', ...many] }, '', '')
    expect(out.images).toHaveLength(10)
    expect(out.images[0]).toBe('https://i.test/0.jpg')
  })

  it('теги: без повторов и #, как их пишет окно поста', () => {
    expect(sharePostPrefill({ tags: ['#Sale', 'sale', 'used bike'] }, '', 'Барт Экс').tags).toEqual(
      ['sale', 'used_bike', 'барт_экс']
    )
  })

  it('имя приложения всегда помещается в предел', () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`)
    const tags = sharePostPrefill({ tags: many }, '', 'Barteron').tags
    expect(tags).toEqual([...many.slice(0, 14), 'barteron'])
    // Имя приложения уже есть в тегах — второй раз не добавляется.
    expect(sharePostPrefill({ tags: ['Barteron'] }, '', 'Barteron').tags).toEqual(['barteron'])
  })
})
