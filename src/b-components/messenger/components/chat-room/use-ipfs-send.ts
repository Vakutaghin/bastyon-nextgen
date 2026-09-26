// Файл в чат через IPFS (только десктоп): без лимита чата в 25 МБ. Файл
// публикуется с этого компьютера в «Мои файлы», в чат уходит ссылка на него —
// у нашего клиента она рисуется карточкой, у остальных остаётся ссылкой.
// Всегда приватно: ключ едет в самом сообщении, в зашифрованном чате его видят
// только участники; шифр кусками (v2), так что размер не ограничен. Получатели
// качают файл у этого компьютера или у тех, кто раздаёт его дальше.
import { ref, type Ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/blockchain'
import { buildShareLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsStore } from '@/stores/ipfs-store'

export function useIpfsSend(send: (text: string) => void): {
  available: boolean
  sending: Ref<boolean>
  sendViaIpfs: () => Promise<void>
} {
  const ipfs = useIpfsStore()
  const auth = useAuthStore()
  const sending = ref(false)

  function showError(): void {
    if (ipfs.message) Modal.error({ title: t('messenger.ipfsSendFailed'), content: ipfs.message })
  }

  async function sendViaIpfs(): Promise<void> {
    // Под Tor IPFS запрещён целиком: Kubo не торифицирован, раздача светила бы IP.
    if (ipfs.torActive) {
      ipfs.showTorBlocked()
      return
    }
    ipfs.message = null
    const picked = await ipfs.pickFiles()
    if (!picked.length) {
      showError()
      return
    }
    sending.value = true
    const hide = message.loading(t('messenger.ipfsPublishing'), 0)
    try {
      // По сообщению на файл: у каждого своя карточка и свой ключ.
      for (const file of picked) {
        const shared = await ipfs.publish(auth.address ?? '', file, 'private')
        if (!shared) {
          showError()
          break
        }
        send(buildShareLink(shared))
      }
    } finally {
      hide()
      sending.value = false
    }
  }

  return { available: ipfs.available, sending, sendViaIpfs }
}
