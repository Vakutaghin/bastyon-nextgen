// «Мои файлы»: что аккаунт опубликовал в IPFS с этого компьютера, раздаются ли
// эти файлы сейчас и где их копии на удалённом сервисе.
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { copyText } from '@/helpers/common/clipboard'
import { buildShareLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsShare, type ShareKind } from '@/composables/use-ipfs-share'
import { useIpfsStore, type IpfsShare, type RemotePinStatus } from '@/stores/ipfs-store'

/** Пока сервис копирует файлы, статусы обновляются так часто. */
const REMOTE_POLL_MS = 15_000

/** Раздаёт ли компьютер файлы прямо сейчас. */
export type NodeState = 'running' | 'starting' | 'stopped' | 'missing'

export interface MyFiles {
  available: boolean
  loading: Ref<boolean>
  files: ComputedRef<IpfsShare[]>
  node: ComputedRef<NodeState>
  remoteConfigured: ComputedRef<boolean>
  sharing: Ref<boolean>
  remoteStatus: (file: IpfsShare) => RemotePinStatus | null
  share: (kind: ShareKind) => Promise<void>
  copyLink: (file: IpfsShare) => Promise<void>
  confirmUnshare: (file: IpfsShare) => void
  sendToService: (file: IpfsShare) => Promise<void>
  startNode: () => Promise<void>
  openRemoteSettings: () => void
}

export function useMyFiles(): MyFiles {
  const ipfs = useIpfsStore()
  const auth = useAuthStore()
  const { share: publish, sharing } = useIpfsShare()
  const loading = ref(true)
  const account = computed(() => auth.address ?? '')

  const files = computed(() => (ipfs.sharesAccount === account.value ? ipfs.shares : []))
  const remoteConfigured = computed(() => ipfs.pinServiceConfigured)
  const node = computed<NodeState>(() => {
    if (ipfs.status === 'running') return 'running'
    if (ipfs.busy) return 'starting'
    return ipfs.installed ? 'stopped' : 'missing'
  })

  async function refreshRemote(): Promise<void> {
    if (ipfs.pinServiceConfigured) await ipfs.refreshShareStatus(account.value)
  }

  async function load(): Promise<void> {
    if (!ipfs.available || !account.value) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      await Promise.all([ipfs.hydrate(), ipfs.refreshPinService(), ipfs.loadShares(account.value)])
    } catch (e) {
      appToast.error({ message: t('myFiles.loadFailed'), description: String(e) })
    } finally {
      loading.value = false
    }
    await refreshRemote()
  }

  // Пока сервис дотягивает файлы, их статус меняется сам — опрашиваем.
  let poll: ReturnType<typeof setInterval> | null = null
  const copying = computed(() =>
    Object.values(ipfs.remoteStatus).some((s) => s === 'queued' || s === 'pinning')
  )
  watch(copying, (active) => {
    if (active && !poll) poll = setInterval(() => void refreshRemote(), REMOTE_POLL_MS)
    if (!active && poll) {
      clearInterval(poll)
      poll = null
    }
  })

  onMounted(() => void load())
  watch(account, () => void load())
  onBeforeUnmount(() => {
    if (poll) clearInterval(poll)
  })

  async function share(kind: ShareKind): Promise<void> {
    const shared = await publish(kind)
    if (shared) await refreshRemote()
  }

  async function copyLink(file: IpfsShare): Promise<void> {
    const copied = await copyText(buildShareLink(file))
    if (copied) appToast.success({ message: t('myFiles.linkCopied') })
    else appToast.error({ message: t('myFiles.copyFailed') })
  }

  function confirmUnshare(file: IpfsShare): void {
    Modal.confirm({
      title: t('myFiles.unshareTitle', { name: file.name }),
      content: t(
        ipfs.pinServiceConfigured ? 'myFiles.unshareContentRemote' : 'myFiles.unshareContent'
      ),
      okText: t('myFiles.unshare'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await ipfs.unshare(account.value, file.cid)
        } catch (e) {
          appToast.error({ message: t('myFiles.unshareFailed'), description: String(e) })
        }
      },
    })
  }

  async function sendToService(file: IpfsShare): Promise<void> {
    await ipfs.pinRemote(file.cid)
    await refreshRemote()
  }

  return {
    available: ipfs.available,
    loading,
    files,
    node,
    remoteConfigured,
    sharing,
    remoteStatus: (file) => ipfs.remoteStatus[file.cid] ?? null,
    share,
    copyLink,
    confirmUnshare,
    sendToService,
    startNode: () => ipfs.enable(),
    openRemoteSettings: () => ipfs.openPinConfig(),
  }
}
