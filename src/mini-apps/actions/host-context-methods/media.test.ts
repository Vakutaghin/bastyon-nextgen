import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMediaMethods } from './media'

const getPhoto = vi.fn<(opts: unknown) => Promise<{ base64String?: string }>>()

vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: (opts: unknown) => getPhoto(opts) },
  CameraResultType: { Base64: 'base64' },
  CameraSource: { Prompt: 'PROMPT' },
}))

beforeEach(() => {
  vi.clearAllMocks()
  getPhoto.mockResolvedValue({ base64String: 'IMG' })
})

describe('takePhoto', () => {
  it('throw notsupported когда не Capacitor', async () => {
    const { takePhoto } = createMediaMethods({ isCapacitor: () => false })
    await expect(takePhoto()).rejects.toThrow('mobile:camera:notsupported')
    expect(getPhoto).not.toHaveBeenCalled()
  })

  it('возвращает base64-изображение в happy path', async () => {
    getPhoto.mockResolvedValue({ base64String: 'AAA' })
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    const res = await takePhoto()

    expect(res).toEqual({ images: [{ image: 'AAA' }] })
  })

  it('передаёт ожидаемые опции в Camera.getPhoto', async () => {
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    await takePhoto()

    expect(getPhoto).toHaveBeenCalledWith({
      quality: 85,
      allowEditing: false,
      resultType: 'base64',
      source: 'PROMPT',
    })
  })

  it('throw cancel если base64String отсутствует', async () => {
    getPhoto.mockResolvedValue({})
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    await expect(takePhoto()).rejects.toThrow('mobile:camera:cancel')
  })

  it('маппит "User cancelled" в cancel', async () => {
    getPhoto.mockRejectedValue(new Error('User cancelled photos app'))
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    await expect(takePhoto()).rejects.toThrow('mobile:camera:cancel')
  })

  it('маппит "denied" в cancel и сохраняет cause', async () => {
    const original = new Error('User denied access to camera')
    getPhoto.mockRejectedValue(original)
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    await expect(takePhoto()).rejects.toMatchObject({
      message: 'mobile:camera:cancel',
      cause: original,
    })
  })

  it('пробрасывает прочие ошибки как есть', async () => {
    getPhoto.mockRejectedValue(new Error('some other failure'))
    const { takePhoto } = createMediaMethods({ isCapacitor: () => true })

    await expect(takePhoto()).rejects.toThrow('some other failure')
  })
})
