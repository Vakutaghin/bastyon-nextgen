import type { HostDevice } from './host-context'

export function detectDevice(tauri: boolean, capacitor: boolean): HostDevice {
  if (tauri) return 'tauri'
  if (capacitor) {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      if (/iphone|ipad|ipod/.test(ua)) return 'capacitor_ios'
      if (/android/.test(ua)) return 'capacitor_android'
    }
    return 'capacitor_android'
  }
  return 'browser'
}

export function browserGeolocation(
  signal?: AbortSignal
): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('location:notavailable'))
      return
    }
    if (signal?.aborted) {
      reject(new Error('location:aborted'))
      return
    }
    const watchId = navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('location:notavailable')),
      { enableHighAccuracy: false, timeout: 15_000 }
    )
    signal?.addEventListener('abort', () => {
      // navigator.geolocation API не имеет явного cancel для getCurrentPosition,
      // но watchId здесь undefined — оставляем reject через ошибку.
      void watchId
      reject(new Error('location:aborted'))
    })
  })
}
