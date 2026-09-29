// Мост к Android-плагину MeshRadio: события одного потока расходятся по
// соединениям (и копятся до подписки), байты ходят в base64, отказы плагина
// «код: подробности» становятся RadioError, уведомление — только в фоне.

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (ev: unknown) => void

const h = vi.hoisted(() => {
  const state = {
    listener: null as null | Listener,
    appListener: null as null | ((s: { isActive: boolean }) => void),
  }
  const plugin = {
    addListener: vi.fn(async (_event: string, cb: Listener) => {
      state.listener = cb
      return { remove: async () => {} }
    }),
    setNotice: vi.fn(async () => {}),
    requestNotifications: vi.fn(async () => {}),
    tcpOpen: vi.fn(async (_o: { host: string; port: number }) => ({ link: 7 })),
    serialOpen: vi.fn(async (_o: { path: string; baud?: number }) => ({ link: 8 })),
    bleConnect: vi.fn(async (_o: { id: string }) => ({ link: 9 })),
    bleSubscribe: vi.fn(async (_o: { link: number; characteristic: string }) => {}),
    bleRead: vi.fn(async (_o: { link: number; characteristic: string }) => ({ data: 'AQID' })),
    bleWrite: vi.fn(async (_o: unknown) => {}),
    write: vi.fn(async (_o: { link: number; data: string }) => {}),
    close: vi.fn(async (_o: { link: number }) => {}),
    showMessage: vi.fn(async (_o: unknown) => {}),
    serialPorts: vi.fn(async () => ({ ports: [] })),
    bleScan: vi.fn(async () => ({ devices: [] })),
  }
  return { state, plugin }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
  registerPlugin: () => h.plugin,
}))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_e: string, cb: (s: { isActive: boolean }) => void) => {
      h.state.appListener = cb
      return { remove: async () => {} }
    }),
  },
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { connectBle, openTcp, showMessageNotification } from './capacitor-radio'

function emit(ev: unknown): void {
  h.state.listener?.(ev)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('android radio bridge', () => {
  it('keeps bytes that arrive before the protocol subscribes, then streams the rest', async () => {
    const link = await openTcp('10.0.2.2', 4403)
    emit({ link: 7, kind: 'data', bytes: 'lMMAAA==' }) // 94 c3 00 00
    const got: number[][] = []
    link.onData((d) => got.push(Array.from(d)))
    emit({ link: 7, kind: 'data', bytes: 'AQI=' })
    emit({ link: 99, kind: 'data', bytes: 'AQI=' }) // чужое соединение — мимо
    expect(got).toEqual([
      [0x94, 0xc3, 0, 0],
      [1, 2],
    ])
    expect(h.plugin.setNotice).toHaveBeenCalledWith({
      title: 'mesh.android.serviceTitle',
      text: 'mesh.android.serviceText',
      channel: 'mesh.android.serviceChannel',
    })
  })

  it('writes base64 and reports the close with its reason', async () => {
    const link = await openTcp('10.0.2.2', 4403)
    await link.write(new Uint8Array([0x94, 0xc3, 0, 1, 7]))
    expect(h.plugin.write).toHaveBeenCalledWith({ link: 7, data: 'lMMAAQc=' })
    const closed = vi.fn()
    link.onClose(closed)
    emit({ link: 7, kind: 'closed', reason: 'device_lost' })
    expect(closed).toHaveBeenCalledWith('device_lost')
    await expect(link.write(new Uint8Array([1]))).rejects.toMatchObject({ code: 'link_not_found' })
  })

  it('turns a plugin refusal into a radio error with its code', async () => {
    h.plugin.tcpOpen.mockRejectedValueOnce(
      Object.assign(new Error('address_not_allowed: 8.8.8.8'), { code: 'address_not_allowed' })
    )
    await expect(openTcp('8.8.8.8', 4403)).rejects.toMatchObject({ code: 'address_not_allowed' })
  })

  it('routes GATT notifications by characteristic and reads values', async () => {
    const gatt = await connectBle('AA:BB:CC:DD:EE:FF', 'Heltec')
    const values: number[][] = []
    await gatt.subscribe('ED9DA18C-A800-4F66-A670-AA7547E34453', (d) => values.push(Array.from(d)))
    expect(h.plugin.bleSubscribe).toHaveBeenCalledWith({
      link: 9,
      characteristic: 'ed9da18c-a800-4f66-a670-aa7547e34453',
    })
    emit({
      link: 9,
      kind: 'notify',
      characteristic: 'ed9da18c-a800-4f66-a670-aa7547e34453',
      bytes: 'BQ==',
    })
    emit({ link: 9, kind: 'notify', characteristic: 'other', bytes: 'BQ==' })
    expect(values).toEqual([[5]])
    expect(Array.from(await gatt.read('2c55e69e-4993-11ed-b878-0242ac120002'))).toEqual([1, 2, 3])
  })

  it('shows a message notification only while the app is in the background', async () => {
    await openTcp('10.0.2.2', 4403) // подписка на состояние приложения
    showMessageNotification('Bob', 'на экране')
    expect(h.plugin.showMessage).not.toHaveBeenCalled()
    h.state.appListener?.({ isActive: false })
    showMessageNotification('Bob', 'в фоне')
    expect(h.plugin.showMessage).toHaveBeenCalledWith({
      title: 'Bob',
      body: 'в фоне',
      tag: 'mesh',
      channel: 'mesh.android.messagesChannel',
    })
  })
})
