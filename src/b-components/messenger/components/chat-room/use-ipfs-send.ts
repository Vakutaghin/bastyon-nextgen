// Файл в чат через IPFS (только десктоп): без лимита чата в 25 МБ. Файл
// публикуется с этого компьютера в «Мои файлы», в чат уходит ссылка на него —
// у нашего клиента она рисуется карточкой, у остальных остаётся ссылкой.
// Приватно по умолчанию: ключ едет в самом сообщении, в зашифрованном чате его
// видят только участники. Получатели качают файл у этого компьютера или у тех,
// кто раздаёт его дальше.
import { ref, type Ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/blockchain'
import { buildShareLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsStore, type IpfsPickedFile } from '@/stores/ipfs-store'

/** Как MAX_ENCRYPTED_BYTES в Rust: больше приватно пока не опубликовать. */
export const PRIVATE_MAX_BYTES = 512 * 1024 * 1024

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

  /** Больше 512 МБ приватно не отправить — предлагаем по ссылке. */
  function askPublic(): Promise<boolean> {
    return new Promise((resolve) => {
      Modal.confirm({
        title: t('messenger.ipfsTooBigPrivateTitle'),
        content: t('messenger.ipfsTooBigPrivateContent'),
        okText: t('messenger.ipfsSendPublic'),
        cancelText: t('common.cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }

  async function sendViaIpfs(): Promise<void> {
    // Под Tor IPFS запрещён целиком: Kubo не торифицирован, раздача светила бы IP.
    if (ipfs.torActive) {
      ipfs.showTorBlocked()
      return
    }
    ipfs.message = null
    const picked: IpfsPickedFile | null = await ipfs.pickFile()
    if (!picked) {
      showError()
      return
    }
    const access = picked.size > PRIVATE_MAX_BYTES ? 'public' : 'private'
    if (access === 'public' && !(await askPublic())) return

    sending.value = true
    const hide = message.loading(t('messenger.ipfsPublishing'), 0)
    try {
      const shared = await ipfs.publish(auth.address ?? '', picked, access)
      if (shared) send(buildShareLink(shared))
      else showError()
    } finally {
      hide()
      sending.value = false
    }
  }

  return { available: ipfs.available, sending, sendViaIpfs }
}
