// Автозапуск: запрет автоплея со звуком — повтор без звука; пуск, оборванный
// паузой или закрытием плеера, — не запрет, и ролик снова не запускается.
import { describe, it, expect, vi } from 'vitest'

import { tryAutoplay } from './utils'

function videoWithPlay(...results: Array<'ok' | string>) {
  const video = document.createElement('video')
  const play = vi.spyOn(video, 'play')
  for (const result of results) {
    if (result === 'ok') play.mockResolvedValueOnce()
    else play.mockRejectedValueOnce(new DOMException('play() failed', result))
  }
  return { video, play }
}

describe('tryAutoplay', () => {
  it('браузер запретил звук — запускает без звука', async () => {
    const { video, play } = videoWithPlay('NotAllowedError', 'ok')
    expect(await tryAutoplay(video)).toEqual({ played: true, muted: true })
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('пуск оборвали пауза или закрытие плеера — не запускает снова', async () => {
    const { video, play } = videoWithPlay('AbortError', 'ok')
    expect(await tryAutoplay(video)).toEqual({ played: false, muted: false })
    expect(play).toHaveBeenCalledTimes(1)
    expect(video.muted).toBe(false)
  })
})
