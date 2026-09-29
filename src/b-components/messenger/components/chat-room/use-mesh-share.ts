// Свой адрес Reticulum в обычный чат: если пропадёт интернет, собеседник
// напишет через mesh-сеть. У сообщения с адресом `lxmf@…` приложение
// собеседника покажет кнопку «Написать через Reticulum» (message-item);
// в Sideband и NomadNet такая ссылка тоже открывает переписку.
import { useRouter } from 'vue-router'
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { useReticulumStore } from '@/mesh/store/reticulum-store'

export function useMeshShare(send: (text: string) => void): {
  available: boolean
  shareAddress: () => void
} {
  const rns = useReticulumStore()
  const router = useRouter()

  function shareAddress(): void {
    if (rns.status !== 'running' || !rns.address) {
      appToast.info({ message: t('mesh.share.startNode') })
      void router.push({ path: '/mesh', query: { net: 'reticulum' } })
      return
    }
    send(t('mesh.share.text', { address: `lxmf@${rns.address}` }))
  }

  return { available: rns.available, shareAddress }
}
