// Опубликовать файл в IPFS от имени текущего аккаунта: нативный диалог выбора
// файла (Rust), публикация по токену, запись в «Мои файлы», ссылка в буфер
// обмена и окно с ней.
import { ref, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import { copyText } from '@/helpers/common/clipboard'
import { buildShareLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsStore, type IpfsShare } from '@/stores/ipfs-store'

export type ShareKind = 'public' | 'private'

/** Окно после публикации: ссылка скопирована или (буфер недоступен) показана. */
const DONE_TEXT = {
  public: {
    title: 'header.ipfsShareDoneTitle',
    copied: 'header.ipfsShareDoneCopied',
    shown: 'header.ipfsShareDone',
  },
  private: {
    title: 'header.ipfsShareEncryptedDoneTitle',
    copied: 'header.ipfsShareEncryptedCopied',
    shown: 'header.ipfsShareEncryptedDone',
  },
} as const

export function useIpfsShare(): {
  sharing: Ref<boolean>
  share: (kind: ShareKind) => Promise<IpfsShare[]>
} {
  const ipfs = useIpfsStore()
  const auth = useAuthStore()
  const sharing = ref(false)

  async function share(kind: ShareKind): Promise<IpfsShare[]> {
    // Под Tor IPFS запрещён целиком: Kubo не торифицирован, раздача светила бы IP.
    if (ipfs.torActive) {
      ipfs.showTorBlocked()
      return []
    }
    const account = auth.address ?? ''
    sharing.value = true
    ipfs.message = null
    const shared: IpfsShare[] = []
    try {
      for (const picked of await ipfs.pickFiles()) {
        const one = await ipfs.publish(account, picked, kind)
        if (!one) break
        shared.push(one)
      }
      if (ipfs.message) {
        Modal.error({ title: t('header.ipfsShareFailedTitle'), content: ipfs.message })
      }
      if (shared.length > 1) {
        appToast.success({ message: t('myFiles.publishedMany', { count: shared.length }) })
      } else if (shared[0]) {
        const link = buildShareLink(shared[0])
        const text = DONE_TEXT[kind]
        const copied = await copyText(link)
        Modal.success({
          title: t(text.title),
          content: t(copied ? text.copied : text.shown, { link }),
        })
      }
      return shared
    } finally {
      sharing.value = false
    }
  }

  return { sharing, share }
}
