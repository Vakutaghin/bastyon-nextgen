// Свои адреса в mesh-сетях в обычный чат: подписанные записи связки (аккаунт
// ↔ адрес в Reticulum, MeshCore, Meshtastic; src/mesh/binding.ts) в
// зашифрованном теле сообщения. Приложение собеседника их проверяет и
// запоминает mesh-маршруты: если пропадёт интернет, переписка продолжится
// через mesh-сеть в этом же чате (use-mesh-routes). Текст сообщения — с
// адресом `lxmf@…`: его поймут и Sideband с NomadNet.
import { useRouter } from 'vue-router'
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { useReticulumStore } from '@/mesh/store/reticulum-store'

export function useMeshShare(share: () => Promise<'sent' | 'no_node' | 'failed'>): {
  available: boolean
  shareAddress: () => Promise<void>
} {
  const rns = useReticulumStore()
  const router = useRouter()

  async function shareAddress(): Promise<void> {
    const result = await share()
    if (result === 'no_node') {
      appToast.info({ message: t('mesh.share.startNode') })
      void router.push({ path: '/mesh', query: { net: 'reticulum' } })
    } else if (result === 'failed') {
      appToast.error({ message: t('mesh.share.failed') })
    }
  }

  return { available: rns.available, shareAddress }
}
