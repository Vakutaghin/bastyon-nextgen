<template>
  <Modal
    :open="viewer.open"
    :title="title"
    :footer="null"
    :width="760"
    :z-index="MODAL_Z"
    @cancel="viewer.close()"
  >
    <SC_ViewerBody>
      <SC_Address v-if="current">{{ ipfsAddress(current) }}</SC_Address>
      <SC_Note v-if="nameText">{{ nameText }}</SC_Note>

      <SC_Status v-if="phase === 'loading'" role="status">
        <Spin />
        <SC_StatusText>
          <SC_StatusHeading>{{ loadingHeading }}</SC_StatusHeading>
          <SC_StatusDetail v-if="loadingDetail">{{ loadingDetail }}</SC_StatusDetail>
        </SC_StatusText>
      </SC_Status>

      <SC_Status v-else-if="phase === 'error'" role="alert">
        <SC_StatusText>
          <SC_StatusHeading>{{ failure.heading }}</SC_StatusHeading>
          <SC_StatusDetail>{{ failure.detail }}</SC_StatusDetail>
        </SC_StatusText>
      </SC_Status>

      <template v-else-if="phase === 'file' && file">
        <SC_Preview v-if="preview && preview.kind !== 'text'">
          <img v-if="preview.kind === 'image'" :src="preview.url" :alt="file.name" />
          <video v-else-if="preview.kind === 'video'" :src="preview.url" controls playsinline />
          <audio v-else :src="preview.url" controls />
        </SC_Preview>
        <SC_Preview v-else-if="preview">
          <SC_Text>{{ preview.text }}</SC_Text>
        </SC_Preview>
        <SC_FileCard v-else>
          <FileOutlined />
          <SC_FileCardText>
            <span>{{ file.name }}</span>
            <SC_Note>{{ formatFileSize(file.size) }}</SC_Note>
          </SC_FileCardText>
        </SC_FileCard>
        <SC_Note v-if="preview?.cut">{{ t('header.ipfsViewerTextCut') }}</SC_Note>
        <SC_Note v-else-if="!preview">{{ noPreviewText }}</SC_Note>
        <SC_Note>{{ t('header.ipfsViewerVerified') }}</SC_Note>
      </template>

      <template v-else-if="phase === 'directory'">
        <SC_Note v-if="isSite">{{ t('header.ipfsViewerSiteHint') }}</SC_Note>
        <SC_Note v-if="!entries.length">{{ t('header.ipfsViewerFolderEmpty') }}</SC_Note>
        <SC_EntryList v-else>
          <li v-for="entry in entries" :key="entry.name">
            <SC_EntryButton type="button" :title="entry.name" @click="enter(entry.name)">
              <FolderOutlined v-if="entry.kind === 'directory'" />
              <FileOutlined v-else />
              <SC_EntryName>{{ entry.name }}</SC_EntryName>
              <SC_EntrySize v-if="entry.kind !== 'directory'">
                {{ formatFileSize(entry.size) }}
              </SC_EntrySize>
            </SC_EntryButton>
          </li>
        </SC_EntryList>
        <SC_Note v-if="truncated">
          {{ t('header.ipfsViewerFolderTruncated', { n: entries.length }) }}
        </SC_Note>
      </template>

      <SC_Note v-if="saveText" role="status">{{ saveText }}</SC_Note>

      <SC_Actions>
        <Button v-if="history.length" @click="back">
          <ArrowLeftIcon />
          {{ t('header.ipfsViewerBack') }}
        </Button>
        <SC_Spacer />
        <Button v-if="current" @click="openInBrowser">
          {{ isSite ? t('header.ipfsViewerOpenSite') : t('header.ipfsViewerOpenBrowser') }}
        </Button>
        <Button v-if="saving" @click="cancelSave">{{ t('header.ipfsSaveCancel') }}</Button>
        <Button v-else-if="phase === 'file'" type="primary" @click="save">
          <DownloadOutlined />
          {{ t('header.ipfsWebDownloadBtn') }}
        </Button>
      </SC_Actions>
    </SC_ViewerBody>
  </Modal>
</template>

<script setup lang="ts">
// Окно просмотра IPFS-ссылок, когда своей ноды нет: веб, телефон и компьютер
// без модуля. Содержимое качает узел IPFS в самом приложении, каждый блок
// сверяется со своим CID. Картинку, звук, видео и текст окно показывает из уже
// проверенных байт, папку — списком, остальное предлагает скачать. Сайты (и
// всё остальное по желанию) открываются в браузере через inbrowser.link: чужой
// HTML на origin приложения открывать нельзя.
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Spin } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { ArrowLeftIcon, DownloadOutlined, FileOutlined, FolderOutlined } from '@/components/icons'
import { fileName, saveBlob, saveFromNetwork, webErrorText } from '@/composables/ipfs-browser-open'
import { openExternal } from '@/helpers/common/open-external'
import { formatDateTimeMedium } from '@/helpers/common/date-formatter'
import { TransportError, isAbortError } from '@/helpers/ipfs/ipfs-errors'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import type { NameInfo } from '@/helpers/ipfs/ipfs-node'
import { loadIpfsNode } from '@/helpers/ipfs/ipfs-node-loader'
import { canPreview, TEXT_PREVIEW_BYTES, type PreviewKind } from '@/helpers/ipfs/ipfs-preview'
import { ipfsAddress } from '@/helpers/ipfs/ipfs-recent'
import { MAX_FILE_BYTES, openSaveSink } from '@/helpers/ipfs/ipfs-save-sinks'
import { guessContentType } from '@/helpers/ipfs/ipfs-sniff'
import { buildIpfsWebUrl } from '@/helpers/ipfs/ipfs-viewer'
import { useIpfsNodeViewerStore } from '@/stores/ipfs-node-viewer-store'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  SC_Actions,
  SC_Address,
  SC_EntryButton,
  SC_EntryList,
  SC_EntryName,
  SC_EntrySize,
  SC_FileCard,
  SC_FileCardText,
  SC_Note,
  SC_Preview,
  SC_Spacer,
  SC_Status,
  SC_StatusDetail,
  SC_StatusHeading,
  SC_StatusText,
  SC_Text,
  SC_ViewerBody,
} from './ipfs-node-viewer.styled'

/** Окно открыл сам пользователь — выше автоматических («Что нового»). */
const MODAL_Z = Z_INDEX.MODAL
/** Через столько окно объясняет, что поиск бывает долгим. */
const SLOW_HINT_MS = 8_000
/** Сколько записей папки показывается. */
const DIR_LIMIT = 1000
/** У стольких первых записей узнаётся, папка это или файл, и точный размер. */
const STAT_LIMIT = 200
/** Столько записей узнаётся одновременно. */
const STAT_PARALLEL = 6

type Phase = 'loading' | 'file' | 'directory' | 'error'

interface ViewFile {
  name: string
  size: number
  type: string
}

interface ViewEntry {
  name: string
  size: number
  kind: 'directory' | 'file' | null
}

interface Preview {
  kind: PreviewKind
  url?: string
  text?: string
  /** Текст показан не целиком. */
  cut?: boolean
  /** Весь файл: «Скачать» берёт его отсюда, без второго скачивания. */
  blob?: Blob
}

const viewer = useIpfsNodeViewerStore()
const { t } = useI18n()

const current = ref<IpfsTarget | null>(null)
const history = ref<IpfsTarget[]>([])
const phase = ref<Phase>('loading')
const slow = ref(false)
const progress = ref<{ done: number; total: number } | null>(null)
const failure = ref({ heading: '', detail: '' })
const name = ref<NameInfo | null>(null)
const file = ref<ViewFile | null>(null)
const preview = shallowRef<Preview | null>(null)
const entries = ref<ViewEntry[]>([])
const truncated = ref(false)
const saving = ref(false)
const saveText = ref('')

let loading: AbortController | null = null
let savingCtl: AbortController | null = null

const title = computed(() => file.value?.name || current.value?.root || 'IPFS')

const isSite = computed(
  () => phase.value === 'directory' && entries.value.some((e) => e.name === 'index.html')
)

const nameText = computed(() => {
  const info = name.value
  if (!info) return ''
  if (info.kind === 'dnslink') return t('header.ipfsViewerNameDnslink', { value: info.value })
  if (!info.validUntil) return t('header.ipfsViewerNameIpnsNoDate', { value: info.value })
  return t('header.ipfsViewerNameIpns', {
    value: info.value,
    date: formatDateTimeMedium(info.validUntil.getTime()),
  })
})

const loadingHeading = computed(() =>
  progress.value ? t('header.ipfsWebDownloadingTitle') : t('header.ipfsViewerSearching')
)

const loadingDetail = computed(() => {
  const p = progress.value
  if (p) {
    return t('header.ipfsWebProgress', {
      done: formatFileSize(p.done),
      total: formatFileSize(p.total),
    })
  }
  return slow.value ? t('header.ipfsViewerSlow') : ''
})

const noPreviewText = computed(() => {
  const f = file.value
  if (!f) return ''
  // Тип показываемый, но файл больше потолка — дело в размере.
  return canPreview(f.type, 0, navigator.userAgent)
    ? t('header.ipfsViewerTooBig')
    : t('header.ipfsViewerNoPreview')
})

function clearView(): void {
  loading?.abort()
  loading = null
  if (preview.value?.url) URL.revokeObjectURL(preview.value.url)
  preview.value = null
  file.value = null
  entries.value = []
  truncated.value = false
  progress.value = null
  name.value = null
  saveText.value = ''
}

/** Последний сегмент пути — имя файла, как в ссылке «Моих файлов». */
function lastSegment(target: IpfsTarget): string {
  const raw = target.path.split('/').filter(Boolean).pop() ?? ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function showError(e: unknown): void {
  phase.value = 'error'
  if (e instanceof TransportError && e.reason === 'timeout') {
    failure.value = {
      heading: t('header.ipfsViewerNotFound'),
      detail: t('header.ipfsViewerNotFoundDetail'),
    }
    return
  }
  failure.value = { heading: t('header.ipfsViewerFailed'), detail: webErrorText(e, null) }
}

async function load(target: IpfsTarget): Promise<void> {
  clearView()
  current.value = target
  phase.value = 'loading'
  slow.value = false
  const ctl = new AbortController()
  loading = ctl
  const slowTimer = setTimeout(() => (slow.value = true), SLOW_HINT_MS)
  try {
    const node = await loadIpfsNode()
    const opened = await node.openIpfs(target, { signal: ctl.signal, maxBytes: MAX_FILE_BYTES })
    if (ctl.signal.aborted) return
    name.value = opened.name
    if (opened.entity.kind === 'directory') {
      const listing = await node.listDirectory(opened.source, opened.entity.cid, DIR_LIMIT)
      if (ctl.signal.aborted) return
      entries.value = listing.entries.map((e) => ({
        name: e.name,
        size: e.size,
        kind: e.cid.code === 0x55 ? 'file' : null,
      }))
      truncated.value = listing.truncated
      phase.value = 'directory'
      void statEntries(node, opened.source, listing.entries, ctl.signal)
      return
    }
    await showFile(target, opened.entity, ctl)
  } catch (e) {
    if (ctl.signal.aborted || isAbortError(e)) return
    showError(e)
  } finally {
    clearTimeout(slowTimer)
  }
}

type NodeModule = Awaited<ReturnType<typeof loadIpfsNode>>
type FileEntity = Extract<Awaited<ReturnType<NodeModule['openIpfs']>>['entity'], { kind: 'file' }>

/**
 * Папка или файл каждая запись и её точный размер: для этого читается корень
 * записи. Фоном и только у первых записей — список показан сразу.
 */
async function statEntries(
  node: NodeModule,
  source: Awaited<ReturnType<NodeModule['openIpfs']>>['source'],
  listed: Awaited<ReturnType<NodeModule['listDirectory']>>['entries'],
  signal: AbortSignal
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < Math.min(listed.length, STAT_LIMIT) && !signal.aborted) {
      const i = next++
      const entry = listed[i]
      if (!entry) return
      try {
        const stat = await node.statEntry(source, entry)
        const view = entries.value[i]
        if (signal.aborted || !view) return
        if (stat.kind === 'directory') view.kind = 'directory'
        else if (stat.kind === 'file') entries.value[i] = { ...view, kind: 'file', size: stat.size }
      } catch {
        // Не узнали — запись остаётся без значка папки; открыть её всё равно можно.
      }
    }
  }
  await Promise.all(Array.from({ length: STAT_PARALLEL }, worker))
}

async function showFile(
  target: IpfsTarget,
  entity: FileEntity,
  ctl: AbortController
): Promise<void> {
  const first = await entity.chunks.next()
  const head = first.done ? new Uint8Array() : first.value
  const linkName = lastSegment(target)
  const type = guessContentType(linkName, head)
  file.value = { name: fileName(linkName, target, type), size: entity.size, type }
  const kind = canPreview(type, entity.size, navigator.userAgent)
  if (!kind) {
    // Показывать нечего: дальше файл качается только по «Скачать».
    ctl.abort()
    phase.value = 'file'
    return
  }
  const parts: Uint8Array[] = head.length ? [head] : []
  let received = head.length
  if (kind === 'text') {
    for await (const chunk of entity.chunks) {
      if (received >= TEXT_PREVIEW_BYTES) break
      parts.push(chunk)
      received += chunk.length
    }
    if (ctl.signal.aborted) return
    const bytes = await new Blob(parts as Uint8Array<ArrayBuffer>[]).arrayBuffer()
    const text = new TextDecoder().decode(bytes.slice(0, TEXT_PREVIEW_BYTES))
    preview.value = { kind, text, cut: entity.size > TEXT_PREVIEW_BYTES }
    ctl.abort()
    phase.value = 'file'
    return
  }
  progress.value = { done: received, total: entity.size }
  for await (const chunk of entity.chunks) {
    parts.push(chunk)
    received += chunk.length
    progress.value = { done: received, total: entity.size }
  }
  if (ctl.signal.aborted) return
  const blob = new Blob(parts as Uint8Array<ArrayBuffer>[], { type })
  preview.value = { kind, blob, url: URL.createObjectURL(blob) }
  progress.value = null
  phase.value = 'file'
}

function enter(entryName: string): void {
  const target = current.value
  if (!target) return
  history.value.push(target)
  const path = [target.path, encodeURIComponent(entryName)].filter(Boolean).join('/')
  void load({ ...target, path })
}

function back(): void {
  const previous = history.value.pop()
  if (previous) void load(previous)
}

/** Синхронно, по клику: иначе браузер не откроет вкладку. */
function openInBrowser(): void {
  if (current.value) void openExternal(buildIpfsWebUrl(current.value))
}

async function save(): Promise<void> {
  const target = current.value
  const f = file.value
  if (!target || !f || saving.value) return
  // Диалог сохранения — первым делом: браузер пускает его только по клику.
  const sink = await openSaveSink(f.name)
  if (!sink) return
  const ctl = new AbortController()
  savingCtl = ctl
  saving.value = true
  saveText.value = ''
  try {
    const blob = preview.value?.blob
    if (blob) await saveBlob(blob, sink)
    else {
      await saveFromNetwork(target, sink, {
        signal: ctl.signal,
        show: (text) => (saveText.value = text),
      })
    }
    saveText.value = ''
    if (sink.kind !== 'share') appToast.success({ message: t('header.ipfsSaveDoneTitle') })
  } catch (e) {
    await sink.abort()
    saveText.value = isAbortError(e) ? '' : webErrorText(e, sink.kind)
  } finally {
    saving.value = false
    savingCtl = null
  }
}

function cancelSave(): void {
  savingCtl?.abort()
}

watch(
  () => viewer.seq,
  () => {
    if (!viewer.target) return
    history.value = []
    void load(viewer.target)
  },
  { immediate: true }
)

watch(
  () => viewer.open,
  (open) => {
    if (open) return
    cancelSave()
    clearView()
    current.value = null
    history.value = []
  }
)

onBeforeUnmount(() => {
  cancelSave()
  clearView()
})
</script>
