import { describe, expect, it } from 'vitest'
import { extensionFor, guessContentType, typeFromBytes, typeFromName } from './ipfs-sniff'

const bytes = (...parts: Array<string | number[]>): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? Array.from(p, (c) => c.charCodeAt(0)) : p))
  )

describe('typeFromName', () => {
  it('по расширению, без учёта регистра', () => {
    expect(typeFromName('photo.JPG')).toBe('image/jpeg')
    expect(typeFromName('archive.tar.gz')).toBe('application/gzip')
    expect(typeFromName('Report.PDF')).toBe('application/pdf')
  })

  it('без расширения, с незнакомым или «скрытый файл» — неизвестно', () => {
    for (const name of ['', 'README', 'data.xyz', '.bashrc', 'trailing.']) {
      expect(typeFromName(name), name).toBeNull()
    }
  })
})

describe('typeFromBytes', () => {
  it('надёжные сигнатуры', () => {
    expect(typeFromBytes(bytes('%PDF-1.7'))).toBe('application/pdf')
    expect(typeFromBytes(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(typeFromBytes(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(typeFromBytes(bytes('GIF89a'))).toBe('image/gif')
    expect(typeFromBytes(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('image/webp')
    expect(typeFromBytes(bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt '))).toBe('audio/wav')
    expect(typeFromBytes(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm')
    expect(typeFromBytes(bytes('ID3', [4, 0]))).toBe('audio/mpeg')
    expect(typeFromBytes(bytes('fLaC'))).toBe('audio/flac')
    expect(typeFromBytes(bytes('PK', [3, 4]))).toBe('application/zip')
    expect(typeFromBytes(bytes([0x1f, 0x8b, 0x08]))).toBe('application/gzip')
  })

  it('ISO BMFF: тип по бренду ftyp', () => {
    const ftyp = (brand: string) => bytes([0, 0, 0, 0x18], 'ftyp', brand, [0, 0, 0, 0])
    expect(typeFromBytes(ftyp('isom'))).toBe('video/mp4')
    expect(typeFromBytes(ftyp('avif'))).toBe('image/avif')
    expect(typeFromBytes(ftyp('heic'))).toBe('image/heic')
    expect(typeFromBytes(ftyp('M4A '))).toBe('audio/mp4')
    expect(typeFromBytes(ftyp('qt  '))).toBe('video/quicktime')
  })

  it('Ogg: тип по кодеку, неизвестный — не угадываем', () => {
    expect(typeFromBytes(bytes('OggS', [0, 2], '....', [1], 'vorbis'))).toBe('audio/ogg')
    expect(typeFromBytes(bytes('OggS', [0, 2], '....', 'OpusHead'))).toBe('audio/ogg')
    expect(typeFromBytes(bytes('OggS', [0, 2], '....', [0x80], 'theora'))).toBe('video/ogg')
    expect(typeFromBytes(bytes('OggS', [0, 2], '....', 'Speex'))).toBe('application/ogg')
  })

  it('кадр MPEG-аудио без ID3 не угадывается — слишком слабая сигнатура', () => {
    expect(typeFromBytes(bytes([0xff, 0xfb, 0x90, 0x00]))).toBe('application/octet-stream')
  })

  it('текст и html; двоичные байты — не текст', () => {
    expect(typeFromBytes(bytes('hello\nworld\t!'))).toBe('text/plain')
    expect(typeFromBytes(new TextEncoder().encode('Привет'))).toBe('text/plain')
    expect(typeFromBytes(bytes('  <!DOCTYPE html><html>'))).toBe('text/html')
    expect(typeFromBytes(bytes('<html lang="ru">'))).toBe('text/html')
    expect(typeFromBytes(bytes('<htmlish>'))).toBe('text/plain')
    expect(typeFromBytes(bytes('MZ', [0x90, 0x00, 0x03]))).toBe('application/octet-stream')
    expect(typeFromBytes(new Uint8Array())).toBe('text/plain')
  })
})

describe('guessContentType', () => {
  it('имя важнее содержимого — так решает и шлюз', () => {
    expect(guessContentType('notes.csv', bytes('a,b\n1,2'))).toBe('text/csv')
    expect(guessContentType('', bytes('%PDF-1.4'))).toBe('application/pdf')
    expect(guessContentType('blob', bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png'
    )
  })

  it('расширение для голого CID по угаданному типу', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('application/octet-stream')).toBeNull()
  })
})
