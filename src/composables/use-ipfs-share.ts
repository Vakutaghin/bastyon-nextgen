// Опубликовать файл в IPFS от имени текущего аккаунта: нативный диалог выбора
// файла (Rust), запись в «Мои файлы», ссылка в буфер обмена и окно с ней.
import { ref, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
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
  share: (kind: ShareKind) => Promise<IpfsShare | null>
} {
  const ipfs = useIpfsStore()
  const auth = useAuthStore()
  const sharing = ref(false)

  async function share(kind: ShareKind): Promise<IpfsShare | null> {
    // Под Tor IPFS запрещён целиком: Kubo не торифицирован, раздача светила бы IP.
    if (ipfs.torActive) {
      ipfs.showTorBlocked()
      return null
    }
    const account = auth.address ?? ''
    sharing.value = true
    ipfs.message = null
    try {
      const shared =
        kind === 'private' ? await ipfs.addFileEncrypted(account) : await ipfs.addFile(account)
      if (!shared) {
        if (ipfs.message) {
          Modal.error({ title: t('header.ipfsShareFailedTitle'), content: ipfs.message })
        }
        return null
      }
      const link = buildShareLink(shared)
      const text = DONE_TEXT[kind]
      const copied = await copyText(link)
      Modal.success({
        title: t(text.title),
        content: t(copied ? text.copied : text.shown, { link }),
      })
      return shared
    } finally {
      sharing.value = false
    }
  }

  return { sharing, share }
}
