// «Мои файлы»: что аккаунт опубликовал в IPFS с этого компьютера, раздаются ли
// эти файлы сейчас, где их копии на удалённом сервисе и постоянные ссылки на них.
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { copyText } from '@/helpers/common/clipboard'
import { buildNameLink, buildNameValue, buildShareLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsShare, type ShareKind } from '@/composables/use-ipfs-share'
import { useIpfsStore, type IpfsShare, type RemotePinStatus } from '@/stores/ipfs-store'
import { BlockedByTorError, useIpnsNamesStore, type OwnName } from '@/stores/ipns-names-store'

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
  /** Файла на сервисе нет или сервис его не сохранил — можно отправить (снова). */
  canSendToService: (file: IpfsShare) => boolean
  share: (kind: ShareKind) => Promise<void>
  copyLink: (file: IpfsShare) => Promise<void>
  confirmUnshare: (file: IpfsShare) => void
  sendToService: (file: IpfsShare) => Promise<void>
  startNode: () => Promise<void>
  openRemoteSettings: () => void
  /** Постоянные ссылки аккаунта. */
  permanent: ComputedRef<OwnName[]>
  /** Открытая в диалоге постоянная ссылка. */
  dialog: Ref<OwnName | null>
  /** Создаётся или переводится постоянная ссылка. */
  naming: Ref<boolean>
  /** Публичные файлы: на них может вести постоянная ссылка. */
  publicFiles: ComputedRef<IpfsShare[]>
  /** Постоянная ссылка, которая ведёт на этот файл. */
  permanentOf: (file: IpfsShare) => OwnName | undefined
  /** Куда ведёт постоянная ссылка: имя файла или что есть. */
  targetOf: (entry: OwnName) => string
  /** Есть ли ещё файл, на который ведёт ссылка. */
  targetShared: (entry: OwnName) => boolean
  openPermanent: (file: IpfsShare) => Promise<void>
  copyPermanent: (entry: OwnName) => Promise<void>
  pointPermanent: (entry: OwnName, file: IpfsShare) => Promise<void>
}

export function useMyFiles(): MyFiles {
  const ipfs = useIpfsStore()
  const names = useIpnsNamesStore()
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
    names.use(account.value)
    try {
      await Promise.all([ipfs.hydrate(), ipfs.refreshPinService(), ipfs.loadShares(account.value)])
    } catch (e) {
      appToast.error({ message: t('myFiles.loadFailed'), description: String(e) })
    } finally {
      loading.value = false
    }
    // Имена с других устройств и свежие значения своих — фоном.
    names.sync().catch((e: unknown) => console.warn('[ipns] sync failed:', e))
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
    if (shared.length) await refreshRemote()
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

  const permanent = computed(() => (names.account === account.value ? names.names : []))
  const dialog = ref<OwnName | null>(null)
  const naming = ref(false)
  const publicFiles = computed(() => files.value.filter((f) => !f.key))

  const permanentOf = (file: IpfsShare): OwnName | undefined => {
    const value = buildNameValue(file)
    return permanent.value.find((n) => n.value === value)
  }

  const shareOf = (entry: OwnName): IpfsShare | undefined =>
    files.value.find((f) => buildNameValue(f) === entry.value)

  /** Имя файла из пути `/ipfs/<cid>/<имя>`; без имени — CID. */
  function targetOf(entry: OwnName): string {
    const share = shareOf(entry)
    if (share) return share.name
    const [, , cid = '', ...rest] = entry.value.split('/')
    return rest.join('/') || cid
  }

  async function openPermanent(file: IpfsShare): Promise<void> {
    const existing = permanentOf(file)
    if (existing) {
      dialog.value = existing
      return
    }
    naming.value = true
    try {
      dialog.value = await names.create(buildNameValue(file))
    } catch (e) {
      if (!(e instanceof BlockedByTorError)) {
        appToast.error({ message: t('myFiles.permanent.createFailed'), description: String(e) })
      }
    } finally {
      naming.value = false
    }
  }

  async function copyPermanent(entry: OwnName): Promise<void> {
    const copied = await copyText(buildNameLink(entry.name))
    if (copied) appToast.success({ message: t('myFiles.permanent.copied') })
    else appToast.error({ message: t('myFiles.copyFailed') })
  }

  async function pointPermanent(entry: OwnName, file: IpfsShare): Promise<void> {
    naming.value = true
    try {
      dialog.value = await names.point(entry.index, buildNameValue(file))
      appToast.success({ message: t('myFiles.permanent.updated', { name: file.name }) })
    } catch (e) {
      if (!(e instanceof BlockedByTorError)) {
        appToast.error({ message: t('myFiles.permanent.updateFailed'), description: String(e) })
      }
    } finally {
      naming.value = false
    }
  }

  return {
    available: ipfs.available,
    loading,
    files,
    node,
    remoteConfigured,
    sharing,
    remoteStatus: (file) => ipfs.remoteStatus[file.cid] ?? null,
    // Раньше кнопка пропадала и после «сервис не сохранил файл» — повторить
    // было нечем, хотя чаще всего сервис просто не застал компьютер в сети.
    canSendToService: (file) =>
      ipfs.pinServiceConfigured && [undefined, 'failed'].includes(ipfs.remoteStatus[file.cid]),
    share,
    copyLink,
    confirmUnshare,
    sendToService,
    startNode: () => ipfs.enable(),
    openRemoteSettings: () => ipfs.openPinConfig(),
    permanent,
    dialog,
    naming,
    publicFiles,
    permanentOf,
    targetOf,
    targetShared: (entry) => !!shareOf(entry),
    openPermanent,
    copyPermanent,
    pointPermanent,
  }
}
