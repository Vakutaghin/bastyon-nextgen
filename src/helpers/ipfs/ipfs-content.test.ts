import { describe, it, expect } from 'vitest'
import { classify, downloadFilename, type ViewerOs } from './ipfs-content'
import type { IpfsTarget } from './ipfs-link'

const target = (path: string, root = 'bafyCID'): IpfsTarget => ({
  namespace: 'ipfs',
  root,
  path,
})

describe('classify — рендеримые типы', () => {
  const osList: ViewerOs[] = ['macos', 'windows', 'linux', 'other']

  it('text/html → render на всех ОС', () => {
    for (const os of osList) {
      expect(classify('text/html; charset=utf-8', null, os)).toBe('render')
    }
  })

  it('image/* audio/* video/* text/* json/xhtml → render', () => {
    expect(classify('image/png', null, 'linux')).toBe('render')
    expect(classify('audio/mpeg', null, 'linux')).toBe('render')
    expect(classify('video/mp4', null, 'linux')).toBe('render')
    expect(classify('text/plain', null, 'linux')).toBe('render')
    expect(classify('application/json', null, 'linux')).toBe('render')
    expect(classify('application/xhtml+xml', null, 'linux')).toBe('render')
  })

  it('регистр и параметры MIME игнорируются', () => {
    expect(classify('IMAGE/PNG', null, 'macos')).toBe('render')
    expect(classify('Text/HTML ; charset=UTF-8', null, 'macos')).toBe('render')
  })
})

describe('classify — PDF зависит от ОС (WebKitGTK не рендерит)', () => {
  it('render на macOS/Windows', () => {
    expect(classify('application/pdf', null, 'macos')).toBe('render')
    expect(classify('application/pdf', null, 'windows')).toBe('render')
  })
  it('download на Linux/other', () => {
    expect(classify('application/pdf', null, 'linux')).toBe('download')
    expect(classify('application/pdf', null, 'other')).toBe('download')
  })
})

describe('classify — скачиваемые типы', () => {
  it('octet-stream / zip / tar / архивы → download', () => {
    expect(classify('application/octet-stream', null, 'macos')).toBe('download')
    expect(classify('application/zip', null, 'macos')).toBe('download')
    expect(classify('application/x-tar', null, 'macos')).toBe('download')
    expect(classify('application/vnd.ms-excel', null, 'macos')).toBe('download')
  })
})

describe('classify — Content-Disposition: attachment перебивает тип', () => {
  it('attachment → download даже для html/image', () => {
    expect(classify('text/html', 'attachment', 'macos')).toBe('download')
    expect(classify('image/png', 'attachment; filename="a.png"', 'macos')).toBe('download')
  })
  it('inline → не считается attachment', () => {
    expect(classify('text/html', 'inline', 'macos')).toBe('render')
  })
})

describe('classify — пустой/отсутствующий тип → render (браузероподобно)', () => {
  it('null / undefined / пустая строка', () => {
    expect(classify(null, null, 'macos')).toBe('render')
    expect(classify(undefined, null, 'linux')).toBe('render')
    expect(classify('', null, 'windows')).toBe('render')
  })
  it('но attachment без типа всё равно скачивает', () => {
    expect(classify(null, 'attachment', 'macos')).toBe('download')
  })
})

describe('downloadFilename', () => {
  it('берёт имя из Content-Disposition (plain)', () => {
    expect(downloadFilename(target('x/y'), 'attachment; filename="report.pdf"')).toBe('report.pdf')
  })

  it('extended filename* (RFC 5987) приоритетнее и декодируется', () => {
    expect(
      downloadFilename(target('x'), "attachment; filename*=UTF-8''%D1%84%D0%B0%D0%B9%D0%BB.zip")
    ).toBe('файл.zip')
  })

  it('иначе — последний сегмент пути с расширением', () => {
    expect(downloadFilename(target('dir/archive.tar.gz'), null)).toBe('archive.tar.gz')
  })

  it('сегмент без расширения не используется → fallback <root>.bin', () => {
    expect(downloadFilename(target('dir/readme', 'Qmabcdef'), null)).toBe('Qmabcdef.bin')
  })

  it('пустой путь → fallback <root>.bin', () => {
    expect(downloadFilename(target('', 'QmZ'), null)).toBe('QmZ.bin')
  })

  it('санитайзит опасные символы имени', () => {
    expect(downloadFilename(target('x'), 'attachment; filename="a/b:c*.bin"')).toBe('a_b_c_.bin')
  })

  it('обрезает длинный root в fallback', () => {
    const longRoot = 'Q'.repeat(60)
    expect(downloadFilename(target('', longRoot), null)).toBe(`${'Q'.repeat(24)}.bin`)
  })
})
