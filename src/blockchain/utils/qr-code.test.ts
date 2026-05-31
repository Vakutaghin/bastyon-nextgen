import { describe, it, expect } from 'vitest'
import {
  generateQRCode,
  generateMnemonicQRCode,
  generatePrivateKeyQRCode,
  generateQRCodeDataURL,
  generateQRCodeSVG,
  readQRCode,
} from './qr-code'

// Пакет qrcode настоящий — работает в node без canvas.

describe('generateQRCode', () => {
  it('бросает на пустых/не-строковых данных', async () => {
    await expect(generateQRCode('')).rejects.toThrow('Data is required')
    await expect(generateQRCode(123 as unknown as string)).rejects.toThrow('Data is required')
  })

  it('по умолчанию возвращает PNG data URL', async () => {
    const res = await generateQRCode('hello')
    expect(res).toMatch(/^data:image\/png;base64,/)
  })

  it('type=base64 возвращает только base64 без префикса data:', async () => {
    const res = await generateQRCode('hello', { type: 'base64' })
    expect(res).not.toMatch(/^data:/)
    expect(res).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('оборачивает ошибку генерации (слишком длинные данные)', async () => {
    await expect(generateQRCode('x'.repeat(10000))).rejects.toThrow('Failed to generate QR code')
  })
})

describe('generateMnemonicQRCode', () => {
  it('бросает на пустой мнемонике', async () => {
    await expect(generateMnemonicQRCode('')).rejects.toThrow('Mnemonic is required')
  })

  it('возвращает data URL', async () => {
    const res = await generateMnemonicQRCode('twelve words here')
    expect(res).toMatch(/^data:image\/png;base64,/)
  })
})

describe('generatePrivateKeyQRCode', () => {
  it('бросает на пустом ключе', async () => {
    await expect(generatePrivateKeyQRCode('')).rejects.toThrow('Private key is required')
  })

  it('возвращает data URL', async () => {
    const res = await generatePrivateKeyQRCode('Kxxxxprivatekey')
    expect(res).toMatch(/^data:image\/png;base64,/)
  })
})

describe('generateQRCodeDataURL', () => {
  it('возвращает PNG data URL', async () => {
    expect(await generateQRCodeDataURL('data')).toMatch(/^data:image\/png;base64,/)
  })
})

describe('generateQRCodeSVG', () => {
  it('бросает на пустых данных', async () => {
    await expect(generateQRCodeSVG('')).rejects.toThrow('Data is required')
  })

  it('возвращает SVG-разметку', async () => {
    const svg = await generateQRCodeSVG('hello')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

describe('readQRCode (заглушка — чтение не реализовано)', () => {
  it('строка → not implemented', async () => {
    await expect(readQRCode('data:image/png;base64,xxx')).rejects.toThrow('not implemented')
  })

  it('Blob → not implemented', async () => {
    await expect(readQRCode(new Blob(['payload']))).rejects.toThrow('not implemented')
  })

  it('неподдерживаемый формат → ошибка', async () => {
    await expect(readQRCode(42 as unknown as string)).rejects.toThrow('Invalid image format')
  })
})
