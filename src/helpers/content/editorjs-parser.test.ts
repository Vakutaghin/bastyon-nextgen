import { describe, it, expect } from 'vitest'
import { editorjsToHtml } from './editorjs-parser'

/**
 * Регресс на P1-1: `editorjsToHtml` собирает HTML интерполяцией и рендерится
 * через v-html. img `file.url`/`caption` — недоверенный ввод; без escape +
 * финального sanitizeHtml из него вырывался бы onerror-хендлер / <script>.
 */

function parse(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

describe('editorjsToHtml — XSS (P1-1)', () => {
  it('image.file.url не может вырваться из src и навесить onerror', () => {
    const html = editorjsToHtml({
      blocks: [
        {
          type: 'image',
          data: {
            file: { url: 'https://img.host/1.png"><img src=x onerror=alert(1)>' },
            caption: 'ok',
          },
        },
      ],
    })
    const dom = parse(html)
    // Ни один реальный img-узел не несёт onerror-хендлер.
    dom.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('onerror')).toBeNull()
    })
    // Инъецированный breakout не создал исполняемых узлов.
    expect(dom.querySelector('script')).toBeNull()
  })

  it('caption с <script> вырезается финальным sanitizeHtml', () => {
    const html = editorjsToHtml({
      blocks: [
        {
          type: 'image',
          data: { file: { url: 'https://img.host/1.png' }, caption: '<script>alert(1)</script>' },
        },
      ],
    })
    expect(html).not.toContain('<script>')
    expect(parse(html).querySelector('script')).toBeNull()
  })

  it('легитимный контент выживает (параграф + делимитер с классом)', () => {
    const html = editorjsToHtml({
      blocks: [
        { type: 'paragraph', data: { text: 'Hello world' } },
        { type: 'delimiter', data: {} },
        {
          type: 'image',
          data: { file: { url: 'https://img.host/pic.png' }, caption: 'подпись' },
        },
      ],
    })
    expect(html).toContain('Hello world')
    // hr сохраняет класс делимитера (whitelist теперь разрешает class на hr).
    expect(html).toContain('ce-delimiter')
    // Легитимный src проходит.
    expect(html).toContain('https://img.host/pic.png')
    expect(html).toContain('подпись')
  })
})

// ---------------------------------------------------------------------------
// Инъекции во всех полях всех типов блоков: статья приходит из блокчейна
// целиком недоверенной, рендерится через v-html.
// ---------------------------------------------------------------------------

/** Элементы, которых в отрендеренной статье быть не должно ни при каком вводе. */
const FORBIDDEN_TAGS =
  'script, iframe, object, embed, svg, math, style, form, input, base, meta, link'

/** Проверяет, что в HTML нет исполняемого содержимого и внешнего оформления. */
function expectInert(html: string): void {
  const dom = parse(html)
  expect(dom.querySelector(FORBIDDEN_TAGS)).toBeNull()
  dom.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.toLowerCase().startsWith('on'), `${el.tagName}[${attr.name}]`).toBe(false)
      expect(attr.name.toLowerCase(), `${el.tagName}[style]`).not.toBe('style')
      if (attr.name === 'href' || attr.name === 'src') {
        expect(attr.value.trim()).not.toMatch(/^(javascript|vbscript|data:text|livescript):/i)
      }
    }
  })
}

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "' onmouseover='alert(1)",
  'x" onerror="alert(1)',
  '<a href="javascript:alert(1)">клик</a>',
  '<a href="jav&#x09;ascript:alert(1)">клик</a>',
  '<a href="bastyon://x&quot; onmouseover=&quot;alert(1)">клик</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<div style="position:fixed;inset:0">перекрытие</div>',
  '<style>body{display:none}</style>',
  'javascript:alert(1)',
]

/** Куда недоверенная строка может попасть в каждом поддерживаемом блоке. */
const FIELD_BUILDERS: Record<string, (s: string) => { type: string; data: unknown }> = {
  'header.text': (s) => ({ type: 'header', data: { text: s, level: 2 } }),
  'paragraph.text': (s) => ({ type: 'paragraph', data: { text: s } }),
  'list.items (v1)': (s) => ({ type: 'list', data: { style: 'unordered', items: [s] } }),
  'list.items (v2, вложенный)': (s) => ({
    type: 'list',
    data: { style: 'ordered', items: [{ content: 'a', items: [{ content: s }] }] },
  }),
  'image.file.url': (s) => ({ type: 'image', data: { file: { url: s }, caption: 'c' } }),
  'image.caption': (s) => ({
    type: 'image',
    data: { file: { url: 'https://img.host/1.png' }, caption: s },
  }),
  'quote.text': (s) => ({ type: 'quote', data: { text: s } }),
  'quote.caption': (s) => ({ type: 'quote', data: { text: 'q', caption: s } }),
  'quote.alignment': (s) => ({ type: 'quote', data: { text: 'q', alignment: s } }),
  'code.code': (s) => ({ type: 'code', data: { code: s } }),
  'link.link': (s) => ({ type: 'link', data: { link: s } }),
  'link.meta.title': (s) => ({
    type: 'link',
    data: { link: 'https://ok.example', meta: { title: s } },
  }),
  'table.content': (s) => ({ type: 'table', data: { withHeadings: true, content: [[s], [s]] } }),
}

describe('editorjsToHtml — инъекции в каждом поле каждого блока', () => {
  for (const [field, build] of Object.entries(FIELD_BUILDERS)) {
    it.each(PAYLOADS)(`${field}: «%s» не даёт исполняемого HTML`, (payload) => {
      const html = editorjsToHtml({ blocks: [build(payload)] })
      expectInert(html)
      // Та же статья, пришедшая строкой JSON (как в поле поста), — тоже безопасна.
      expectInert(editorjsToHtml(JSON.stringify({ blocks: [build(payload)] })))
    })
  }

  it('javascript: и data:text в адресе картинки не попадают в src', () => {
    for (const url of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>']) {
      const img = parse(
        editorjsToHtml({ blocks: [{ type: 'image', data: { file: { url } } }] })
      ).querySelector('img')
      expect(img?.getAttribute('src') ?? '').toBe('')
    }
  })

  it('кавычка в подписи остаётся текстом alt, а не новым атрибутом', () => {
    const img = parse(
      editorjsToHtml({
        blocks: [
          {
            type: 'image',
            data: { file: { url: 'https://img.host/1.png' }, caption: 'x" onerror="alert(1)' },
          },
        ],
      })
    ).querySelector('img')!
    expect(img.getAttribute('alt')).toBe('x" onerror="alert(1)')
    expect(img.getAttribute('onerror')).toBeNull()
  })

  it('кавычка в bastyon://-ссылке остаётся внутри href', () => {
    const a = parse(
      editorjsToHtml({
        blocks: [
          {
            type: 'paragraph',
            data: { text: '<a href="bastyon://x&quot; onmouseover=&quot;alert(1)">t</a>' },
          },
        ],
      })
    ).querySelector('a')!
    expect(a.getAttribute('onmouseover')).toBeNull()
    expect(a.getAttribute('href')).toBe('bastyon://x" onmouseover="alert(1)')
  })

  it('выравнивание цитаты не может навесить обработчик на blockquote', () => {
    const quote = parse(
      editorjsToHtml({
        blocks: [{ type: 'quote', data: { text: 'q', alignment: 'left" onmouseover="alert(1)' } }],
      })
    ).querySelector('blockquote')!
    expect(quote.getAttribute('onmouseover')).toBeNull()
    expect(quote.className).toBe('ce-quote ce-quote--left')
  })

  it('неизвестные типы блоков (embed, raw) выбрасываются вместе со своим HTML', () => {
    const html = editorjsToHtml({
      blocks: [
        { type: 'raw', data: { html: '<iframe src="https://evil.example"></iframe>' } },
        { type: 'embed', data: { embed: 'https://evil.example', html: '<b>x</b>' } },
        { type: 'paragraph', data: { text: 'остаток' } },
      ],
    })
    expect(html).toBe('<p>остаток</p>')
  })
})

// ---------------------------------------------------------------------------
// Вёрстка поддерживаемых блоков
// ---------------------------------------------------------------------------

describe('editorjsToHtml — заголовок', () => {
  it('уровень 1–6 даёт соответствующий тег, строковый уровень тоже понимается', () => {
    for (const level of [1, 3, 6]) {
      expect(editorjsToHtml({ blocks: [{ type: 'header', data: { text: 'Т', level } }] })).toBe(
        `<h${level}>Т</h${level}>`
      )
    }
    expect(editorjsToHtml({ blocks: [{ type: 'header', data: { text: 'Т', level: '4' } }] })).toBe(
      '<h4>Т</h4>'
    )
  })

  it('уровень вне 1–6 или отсутствующий — h2', () => {
    for (const level of [0, 7, -1, undefined, 'abc']) {
      expect(editorjsToHtml({ blocks: [{ type: 'header', data: { text: 'Т', level } }] })).toBe(
        '<h2>Т</h2>'
      )
    }
  })

  it('<br> и перевод строки в тексте — перенос строки', () => {
    expect(
      editorjsToHtml({ blocks: [{ type: 'header', data: { text: 'а<br/>б\nв', level: 2 } }] })
    ).toBe('<h2>а<br>б<br>в</h2>')
  })

  it('пустой текст — блок не рисуется', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'header', data: { text: '', level: 1 } }] })).toBe('')
  })
})

describe('editorjsToHtml — абзац', () => {
  it('сохраняет разрешённую разметку, переносы и делает ссылки и меншены кликабельными', () => {
    const dom = parse(
      editorjsToHtml({
        blocks: [
          {
            type: 'paragraph',
            data: { text: '<b>жирный</b>\nсм. https://example.com и @alice_b' },
          },
        ],
      })
    )
    expect(dom.querySelector('p b')?.textContent).toBe('жирный')
    expect(dom.querySelector('p br')).not.toBeNull()
    const link = dom.querySelector('a[href="https://example.com"]')!
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(dom.querySelector('a.mention-link')?.getAttribute('href')).toBe('/alice_b')
  })

  it('bastyon:// — внутренняя ссылка без target=_blank', () => {
    const a = parse(
      editorjsToHtml({ blocks: [{ type: 'paragraph', data: { text: 'bastyon://post?s=abc' } }] })
    ).querySelector('a')!
    expect(a.className).toBe('bastyon-link')
    expect(a.getAttribute('target')).toBeNull()
  })

  it('пустой или отсутствующий текст — ничего', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'paragraph', data: { text: '' } }] })).toBe('')
    expect(editorjsToHtml({ blocks: [{ type: 'paragraph', data: null }] })).toBe('')
    expect(editorjsToHtml({ blocks: [{ type: 'paragraph' }] })).toBe('')
  })
})

describe('editorjsToHtml — список', () => {
  it('ordered → ol, иначе ul', () => {
    const ordered = editorjsToHtml({
      blocks: [{ type: 'list', data: { style: 'ordered', items: ['a', 'b'] } }],
    })
    expect(ordered).toBe('<ol><li>a</li><li>b</li></ol>')
    const plain = editorjsToHtml({ blocks: [{ type: 'list', data: { items: ['a'] } }] })
    expect(plain).toBe('<ul><li>a</li></ul>')
  })

  it('элементы v2 ({content, items}) разворачиваются без [object Object]', () => {
    const html = editorjsToHtml({
      blocks: [
        {
          type: 'list',
          data: {
            style: 'unordered',
            items: [{ content: 'родитель', items: [{ content: 'ребёнок', items: [] }] }, 'плоский'],
          },
        },
      ],
    })
    expect(html).toBe('<ul><li>родитель</li><li>ребёнок</li><li>плоский</li></ul>')
  })

  it('пустой, не массив или из одних пустых элементов — блок не рисуется', () => {
    for (const items of [[], 'строка', null, [{}, '', 5]]) {
      expect(editorjsToHtml({ blocks: [{ type: 'list', data: { items } }] })).toBe('')
    }
  })
})

describe('editorjsToHtml — картинка', () => {
  it('флаги оформления становятся классами, подпись — блоком под картинкой', () => {
    const dom = parse(
      editorjsToHtml({
        blocks: [
          {
            type: 'image',
            data: {
              file: { url: 'https://img.host/a.png?w=1&h=2' },
              caption: 'Подпись',
              withBorder: true,
              withBackground: true,
              stretched: true,
            },
          },
        ],
      })
    )
    const wrap = dom.querySelector('div.ce-image')!
    expect(wrap.classList.contains('ce-image--with-border')).toBe(true)
    expect(wrap.classList.contains('ce-image--with-background')).toBe(true)
    expect(wrap.classList.contains('ce-image--stretched')).toBe(true)
    // Амперсанд в адресе не ломается двойным экранированием.
    expect(wrap.querySelector('img')?.getAttribute('src')).toBe('https://img.host/a.png?w=1&h=2')
    expect(wrap.querySelector('img')?.getAttribute('alt')).toBe('Подпись')
    expect(wrap.querySelector('.ce-image__caption')?.textContent).toBe('Подпись')
  })

  it('без подписи — без блока подписи и с пустым alt, без флагов — только базовый класс', () => {
    const dom = parse(
      editorjsToHtml({
        blocks: [{ type: 'image', data: { file: { url: 'https://img.host/a.png' } } }],
      })
    )
    expect(dom.querySelector('div')?.className).toBe('ce-image')
    expect(dom.querySelector('.ce-image__caption')).toBeNull()
    expect(dom.querySelector('img')?.getAttribute('alt')).toBe('')
  })

  it('без файла или адреса — блок не рисуется', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'image', data: { caption: 'x' } }] })).toBe('')
    expect(editorjsToHtml({ blocks: [{ type: 'image', data: { file: {} } }] })).toBe('')
  })
})

describe('editorjsToHtml — цитата', () => {
  it('по умолчанию выравнивание влево, подпись — в footer, <br> сохраняется', () => {
    const dom = parse(
      editorjsToHtml({ blocks: [{ type: 'quote', data: { text: 'а<br>б', caption: 'в<br/>г' } }] })
    )
    const quote = dom.querySelector('blockquote')!
    expect(quote.className).toBe('ce-quote ce-quote--left')
    expect(quote.querySelector('p')?.innerHTML).toBe('а<br>б')
    expect(quote.querySelector('footer.ce-quote__caption')?.innerHTML).toBe('в<br>г')
  })

  it('выравнивание по центру и цитата без подписи', () => {
    const dom = parse(
      editorjsToHtml({ blocks: [{ type: 'quote', data: { text: 'q', alignment: 'center' } }] })
    )
    expect(dom.querySelector('blockquote')?.className).toBe('ce-quote ce-quote--center')
    expect(dom.querySelector('footer')).toBeNull()
  })

  it('без текста — блок не рисуется, даже с подписью', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'quote', data: { caption: 'автор' } }] })).toBe('')
  })
})

describe('editorjsToHtml — код, ссылка, таблица, разделитель', () => {
  it('код показывается как текст: HTML внутри не исполняется и не линкуется', () => {
    const source = '<script>alert("x")</script> & \'y\' https://example.com'
    const dom = parse(editorjsToHtml({ blocks: [{ type: 'code', data: { code: source } }] }))
    expect(dom.querySelector('pre.ce-code code')?.textContent).toBe(source)
    expect(dom.querySelector('a')).toBeNull()
    expect(editorjsToHtml({ blocks: [{ type: 'code', data: { code: '' } }] })).toBe('')
  })

  it('ссылка-карточка: «заголовок — адрес», без заголовка — только адрес', () => {
    const withTitle = parse(
      editorjsToHtml({
        blocks: [{ type: 'link', data: { link: 'https://ex.com/a', meta: { title: 'Статья' } } }],
      })
    ).querySelector('p.ce-link')!
    expect(withTitle.textContent).toBe('Статья — https://ex.com/a')
    expect(withTitle.querySelector('a')?.getAttribute('href')).toBe('https://ex.com/a')

    const bare = parse(
      editorjsToHtml({ blocks: [{ type: 'link', data: { link: 'https://ex.com/a', meta: {} } }] })
    ).querySelector('p.ce-link')!
    expect(bare.textContent).toBe('https://ex.com/a')
  })

  it('ссылка-карточка без адреса или с нестроковым адресом — не рисуется', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'link', data: { meta: { title: 'x' } } }] })).toBe('')
    expect(editorjsToHtml({ blocks: [{ type: 'link', data: { link: 42 } }] })).toBe('')
  })

  it('таблица с заголовками: первая строка — th, остальные — td, ссылки в ячейках', () => {
    const dom = parse(
      editorjsToHtml({
        blocks: [
          {
            type: 'table',
            data: {
              withHeadings: true,
              content: [
                ['Имя', 'Сайт'],
                ['Боб', 'https://bob.example'],
              ],
            },
          },
        ],
      })
    )
    const rows = dom.querySelectorAll('table.ce-table tr')
    expect(rows).toHaveLength(2)
    expect(Array.from(rows.item(0).querySelectorAll('th')).map((c) => c.textContent)).toEqual([
      'Имя',
      'Сайт',
    ])
    expect(rows.item(1).querySelectorAll('td')).toHaveLength(2)
    expect(rows.item(1).querySelector('a')?.getAttribute('href')).toBe('https://bob.example')
  })

  it('таблица без заголовков — все ячейки td; строки-не-массивы пропускаются', () => {
    const dom = parse(
      editorjsToHtml({
        blocks: [{ type: 'table', data: { content: [['a', 'b'], 'мусор', ['c', 'd']] } }],
      })
    )
    expect(dom.querySelectorAll('th')).toHaveLength(0)
    expect(dom.querySelectorAll('tr')).toHaveLength(2)
    expect(dom.querySelectorAll('td')).toHaveLength(4)
  })

  it('пустая таблица или не массив — не рисуется', () => {
    expect(editorjsToHtml({ blocks: [{ type: 'table', data: { content: [] } }] })).toBe('')
    expect(editorjsToHtml({ blocks: [{ type: 'table', data: { content: 'x' } }] })).toBe('')
  })

  it('блоки идут в исходном порядке', () => {
    const html = editorjsToHtml({
      blocks: [
        { type: 'header', data: { text: 'З', level: 1 } },
        { type: 'delimiter', data: {} },
        { type: 'paragraph', data: { text: 'А' } },
      ],
    })
    expect(html).toBe('<h1>З</h1><hr class="ce-delimiter"><p>А</p>')
  })
})

// ---------------------------------------------------------------------------
// Битый и нестандартный ввод
// ---------------------------------------------------------------------------

describe('editorjsToHtml — битый и нестандартный ввод', () => {
  // Пост — чужие данные: вместо строки бывает число, объект, null. Раньше
  // .replace на таком поле ронял рендер всей карточки.
  it('нестроковые поля и null вместо блока не роняют рендер, годные блоки остаются', () => {
    const blocks = [
      null,
      7,
      { type: 'paragraph', data: { text: 5 } },
      { type: 'paragraph', data: { text: { evil: true } } },
      { type: 'header', data: { text: ['a'], level: 2 } },
      { type: 'image', data: { file: { url: 1 }, caption: 2 } },
      { type: 'image', data: { file: 'https://x/y.png' } },
      { type: 'quote', data: { text: null, caption: 3 } },
      { type: 'quote', data: { text: 'цитата', caption: { a: 1 } } },
      { type: 'code', data: { code: 42 } },
      { type: 'link', data: { link: 'https://bastyon.com', meta: 'oops' } },
      { type: 'paragraph', data: { text: 'жив' } },
    ]
    let html = ''
    expect(() => (html = editorjsToHtml({ blocks }))).not.toThrow()
    expect(html).toContain('<p>5</p>')
    expect(html).toContain('цитата')
    expect(html).toContain('42')
    expect(html).toContain('bastyon.com')
    expect(html).toContain('<p>жив</p>')
    expect(html).not.toContain('[object Object]')
    expect(html).not.toContain('<img')
  })

  it('выравнивание цитаты в class — только left или center', () => {
    const html = editorjsToHtml({
      blocks: [{ type: 'quote', data: { text: 'q', alignment: 'x"><b>y</b' } }],
    })
    expect(html).toContain('ce-quote--left')
    expect(html).not.toContain('<b>y')
    expect(
      editorjsToHtml({ blocks: [{ type: 'quote', data: { text: 'q', alignment: 'center' } }] })
    ).toContain('ce-quote--center')
  })

  it('уровень заголовка не целый — обычный h2, а не тег-мусор', () => {
    for (const level of ['6e0', 2.5, 'h1', 0, 7]) {
      const html = editorjsToHtml({ blocks: [{ type: 'header', data: { text: 'Т', level } }] })
      expect(html).toBe(level === '6e0' ? '<h6>Т</h6>' : '<h2>Т</h2>')
    }
  })

  it('пустой ввод — пустая строка', () => {
    expect(editorjsToHtml('')).toBe('')
    expect(editorjsToHtml(null as unknown as string)).toBe('')
  })

  it('JSON-строка рендерится так же, как объект', () => {
    const doc = { blocks: [{ type: 'paragraph', data: { text: 'привет' } }] }
    expect(editorjsToHtml(JSON.stringify(doc))).toBe(editorjsToHtml(doc))
  })

  it('JSON с кавычками-сущностями &quot; раскодируется', () => {
    const encoded = JSON.stringify({
      blocks: [{ type: 'paragraph', data: { text: 'привет' } }],
    }).replace(/"/g, '&quot;')
    expect(editorjsToHtml(encoded)).toBe('<p>привет</p>')
  })

  it('JSON с сырыми переводами строк внутри строк всё равно разбирается', () => {
    const raw = '{"blocks":[{"type":"paragraph","data":{"text":"раз\nдва\tтри"}}]}'
    expect(editorjsToHtml(raw)).toBe('<p>раз<br>два\tтри</p>')
  })

  it('обрезанный JSON статьи: текст, подписи и пункты списков вытаскиваются как текст', () => {
    const truncated =
      '{"blocks":[{"type":"paragraph","data":{"text":"Начало \\u0410"}},' +
      '{"type":"list","data":{"items":["пункт 1","пункт \\"2\\""]}},' +
      '{"type":"image","data":{"caption":"подпись"'
    const text = parse(editorjsToHtml(truncated)).textContent ?? ''
    expect(text).toContain('Начало А')
    expect(text).toContain('• пункт 1')
    expect(text).toContain('• пункт "2"')
    expect(text).toContain('подпись')
    expect(text).not.toContain('"blocks"')
  })

  it('обрезанный JSON, начинающийся с "time", разбирается так же', () => {
    const truncated = '{"time":1700000000,"blocks":[{"type":"paragraph","data":{"text":"z"}}'
    expect(editorjsToHtml(truncated)).toBe('z')
  })

  it('инъекция в обрезанном JSON не исполняется', () => {
    expectInert(
      editorjsToHtml(
        '{"blocks":[{"type":"paragraph","data":{"text":"<img src=x onerror=alert(1)><script>alert(2)</script>"}}'
      )
    )
    expectInert(
      editorjsToHtml(
        '{"blocks":[{"type":"paragraph","data":{"text":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"}}'
      )
    )
  })

  it('обычный текст поста: переносы → <br>, ссылки кликабельны, скрипты вырезаны', () => {
    const html = editorjsToHtml('строка 1\r\nстрока 2 <script>alert(1)</script> https://e.com')
    const dom = parse(html)
    expect(dom.querySelectorAll('br')).toHaveLength(1)
    expect(dom.querySelector('a')?.getAttribute('href')).toBe('https://e.com')
    expect(dom.textContent).not.toContain('alert')
    expectInert(html)
  })

  it('валидный JSON без массива blocks показывается текстом, а не теряется', () => {
    expect(parse(editorjsToHtml('{"foo":"bar"}')).textContent).toBe('{"foo":"bar"}')
    expect(parse(editorjsToHtml('{"blocks":"x"}')).textContent).toBe('{"blocks":"x"}')
  })

  it('инъекция в тексте без блоков тоже обезврежена', () => {
    expectInert(editorjsToHtml('{"foo":"<img src=x onerror=alert(1)>"}'))
    expectInert(editorjsToHtml('<svg onload=alert(1)><a href="javascript:alert(1)">x</a>'))
  })
})
