import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitize-html'

describe('sanitizeHtml — href с нашими схемами', () => {
  it('bastyon:// / ipfs:// / ipns:// остаются кликабельными', () => {
    expect(sanitizeHtml('<a href="bastyon://post/abc">x</a>')).toBe(
      '<a href="bastyon://post/abc">x</a>'
    )
    expect(sanitizeHtml('<a href="ipfs://bafyabc/dir/f.txt#key=k&name=n">x</a>')).toBe(
      '<a href="ipfs://bafyabc/dir/f.txt#key=k&name=n">x</a>'
    )
    expect(sanitizeHtml('<a href="IPNS://example.com/">x</a>')).toBe(
      '<a href="IPNS://example.com/">x</a>'
    )
  })

  it('кавычка в href экранируется — нельзя закрыть атрибут и дописать style/on* (K1)', () => {
    const out = sanitizeHtml(
      '<a href=\'bastyon://" style="position:fixed;inset:0;z-index:2147483647\'>x</a>'
    )
    expect(out).toBe(
      '<a href="bastyon://&quot; style=&quot;position:fixed;inset:0;z-index:2147483647">x</a>'
    )
    expect(out).not.toMatch(/ style="/)
  })

  it('HTML-сущность кавычки не пролезает в DOM как кавычка', () => {
    const out = sanitizeHtml('<a href="bastyon://&#x22; onmouseover=&#x22;alert(1)">x</a>')
    expect(out).toBe('<a href="bastyon://&quot; onmouseover=&quot;alert(1)">x</a>')
    expect(out).not.toMatch(/ onmouseover="/)
  })

  it('javascript: и произвольные схемы по-прежнему режутся, http остаётся', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href>x</a>')
    expect(sanitizeHtml('<a href="foo://bar">x</a>')).toBe('<a href>x</a>')
    expect(sanitizeHtml('<a href="https://bastyon.com/">x</a>')).toBe(
      '<a href="https://bastyon.com/">x</a>'
    )
  })

  it('inline style и on*-атрибуты вырезаются на любых тегах', () => {
    expect(sanitizeHtml('<b style="color:red" onclick="x()">t</b>')).toBe('<b>t</b>')
    expect(sanitizeHtml('<img src="https://h/i.png" onerror="alert(1)">')).toBe(
      '<img src="https://h/i.png">'
    )
  })
})
