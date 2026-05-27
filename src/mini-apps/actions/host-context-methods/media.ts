/**
 * HostContext methods: камера/галерея (Capacitor-only).
 */

import type { HostContext } from '../host-context'

export interface MediaDeps {
  isCapacitor: () => boolean
}

export type MediaMethods = Pick<HostContext, 'takePhoto'>

export function createMediaMethods(deps: MediaDeps): MediaMethods {
  const { isCapacitor } = deps

  return {
    takePhoto: async () => {
      if (!isCapacitor()) {
        throw new Error('mobile:camera:notsupported')
      }
      // Динамический импорт — `@capacitor/camera` подтягивается только на
      // mobile-сборках; в web/desktop SSR это «модуль не найден» если он
      // не зарезолвен на build-time, поэтому ловим оба исхода.
      let cameraMod: typeof import('@capacitor/camera')
      try {
        cameraMod = await import('@capacitor/camera')
      } catch {
        throw new Error('mobile:camera:notsupported')
      }
      try {
        const photo = await cameraMod.Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: cameraMod.CameraResultType.Base64,
          source: cameraMod.CameraSource.Prompt,
        })
        const base64 = photo.base64String
        if (!base64) throw new Error('mobile:camera:cancel')
        return { images: [{ image: base64 }] }
      } catch (e) {
        // Capacitor бросает Error со строкой "User cancelled photos app" /
        // "User denied access to camera" — приводим к legacy `cancel`.
        const msg = e instanceof Error ? e.message.toLowerCase() : ''
        if (msg.includes('cancel') || msg.includes('denied')) {
          throw new Error('mobile:camera:cancel', { cause: e })
        }
        throw e
      }
    },
  }
}
