// Картинки под Tor на компьютере — через свою схему `bastyon-tor`, которую
// отдаёт Rust через Tor: адреса переписываются и у компонентов, и у любых
// <img> в документе.

import { afterEach, describe, expect, it } from 'vitest'

import {
  isRemoteMediaUrl,
  retryTorMedia,
  startTorMediaProxy,
  torMediaSrcset,
  torMediaUrl,
} from './tor-media-proxy'

const IMG = 'https://pocketnet.app:8092/i/a.jpg?x=1'
const viaTor = (url: string) => `bastyon-tor://localhost/${encodeURIComponent(url)}`

describe('torMediaUrl', () => {
  it('удалённое — через схему Tor, своё и встроенное — как есть', () => {
    expect(torMediaUrl(IMG)).toBe(viaTor(IMG))
    for (const own of [
      'data:image/png;base64,AA',
      'blob:x',
      '/assets/logo.svg',
      'asset://localhost/a',
    ]) {
      expect(torMediaUrl(own)).toBe(own)
    }
    // Уже через Tor (на Windows схема — http://bastyon-tor.localhost) — второй раз не оборачиваем.
    expect(isRemoteMediaUrl('http://bastyon-tor.localhost/https%3A%2F%2Fa')).toBe(false)
    expect(isRemoteMediaUrl('http://tauri.localhost/x.png')).toBe(false)
  })

  it('srcset — каждый адрес, дескрипторы на месте', () => {
    expect(torMediaSrcset(`${IMG} 1x, https://a.b/c.png 2x`)).toBe(
      `${viaTor(IMG)} 1x, ${viaTor('https://a.b/c.png')} 2x`
    )
  })
})

describe('startTorMediaProxy', () => {
  let stop: (() => void) | null = null
  afterEach(() => {
    stop?.()
    stop = null
    document.body.innerHTML = ''
  })

  it('переписывает и стоящие картинки, и новые, и смену адреса', async () => {
    document.body.innerHTML = `<img id="a" src="${IMG}"><img id="b" src="data:image/png;base64,AA">`
    stop = startTorMediaProxy(document)
    expect(document.getElementById('a')!.getAttribute('src')).toBe(viaTor(IMG))
    expect(document.getElementById('b')!.getAttribute('src')).toBe('data:image/png;base64,AA')

    const wrap = document.createElement('div')
    wrap.innerHTML = '<img id="c" src="https://x.y/1.png"><video id="v" poster="https://x.y/p.jpg"></video>'
    document.body.appendChild(wrap)
    await Promise.resolve()
    expect(document.getElementById('c')!.getAttribute('src')).toBe(viaTor('https://x.y/1.png'))
    expect(document.getElementById('v')!.getAttribute('poster')).toBe(viaTor('https://x.y/p.jpg'))

    document.getElementById('a')!.setAttribute('src', 'https://x.y/2.png')
    await Promise.resolve()
    expect(document.getElementById('a')!.getAttribute('src')).toBe(viaTor('https://x.y/2.png'))
  })

  it('повторный запуск — тот же наблюдатель; «Tor готов» перепрашивает не загрузившиеся', () => {
    stop = startTorMediaProxy(document)
    expect(startTorMediaProxy(document)).toBe(stop)
    document.body.innerHTML = `<img id="a" src="${viaTor(IMG)}">`
    expect(() => retryTorMedia(document)).not.toThrow()
    expect(document.getElementById('a')!.getAttribute('src')).toBe(viaTor(IMG))
  })
})
