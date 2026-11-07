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
      tags: ['Barteron'],
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

  it('теги: без повторов и #, имя приложения всегда помещается в 5', () => {
    const tags = sharePostPrefill(
      { tags: ['#sale', 'Sale', 'bike', 'city', 'sport', 'extra'] },
      '',
      'Barteron'
    ).tags
    expect(tags).toEqual(['sale', 'bike', 'city', 'sport', 'Barteron'])
    // Имя приложения уже есть в тегах — второй раз не добавляется.
    expect(sharePostPrefill({ tags: ['barteron'] }, '', 'Barteron').tags).toEqual(['barteron'])
  })
})
