<template>
  <SC_FileMessage>
    <SC_FileIcon>
      <LockOutlined v-if="link.secret" />
      <FileOutlined v-else />
    </SC_FileIcon>

    <SC_FileBody>
      <SC_FileName :title="displayName">{{ displayName }}</SC_FileName>
      <SC_FileMeta>
        <span>{{ meta }}</span>
      </SC_FileMeta>
      <SC_IpfsActions>
        <SC_IpfsAction type="button" @click="open">{{ openLabel }}</SC_IpfsAction>
        <SC_IpfsAction v-if="canSeed" type="button" :disabled="seeding || seeded" @click="seed">
          {{ seeded ? t('messenger.ipfsSeeding') : t('messenger.ipfsSeed') }}
        </SC_IpfsAction>
      </SC_IpfsActions>
    </SC_FileBody>
  </SC_FileMessage>
</template>

<script setup lang="ts">
// Сообщение-ссылка на файл в IPFS (так его шлёт «Файл через IPFS»): карточка с
// именем и размером из самой ссылки. «Открыть/Скачать» — тот же путь, что клик
// по ссылке (use-ipfs-links). «Раздавать дальше» (десктоп, чужой файл) —
// закрепить файл у себя, чтобы он жил, пока в сети хоть кто-то из получивших.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { FileOutlined, LockOutlined } from '@/components/icons'
import { openIpfsViewer } from '@/composables/use-ipfs-links'
import type { IpfsFileLink } from '@/helpers/ipfs/ipfs-link'
import { classify, classifyForBrowser, detectViewerOs } from '@/helpers/ipfs/ipfs-content'
import { typeFromName } from '@/helpers/ipfs/ipfs-sniff'
import { useIpfsStore } from '@/stores/ipfs-store'
import { formatFileSize } from '../file-message/helpers'
import {
  SC_FileMessage,
  SC_FileIcon,
  SC_FileBody,
  SC_FileName,
  SC_FileMeta,
} from '../file-message/styled'
import { SC_IpfsActions, SC_IpfsAction } from './styled'

const props = defineProps<{
  link: IpfsFileLink
  /** Своё сообщение: раздавать и так раздаём. */
  mine: boolean
}>()

const { t } = useI18n()
const ipfs = useIpfsStore()
const auth = useAuthStore()

const displayName = computed(() => props.link.name || t('messenger.ipfsCardNoName'))

const meta = computed(() => {
  const kind = t(props.link.secret ? 'messenger.ipfsCardPrivate' : 'messenger.ipfsCardPublic')
  return props.link.size === null ? kind : `${formatFileSize(props.link.size)} · ${kind}`
})

/** «Открыть», если его покажут сразу, иначе «Скачать». Приватный — всегда скачивается. */
const openLabel = computed(() => {
  const type = typeFromName(props.link.name)
  if (props.link.secret) return t('messenger.ipfsDownload')
  if (!type) return t('messenger.ipfsOpen')
  const shown = ipfs.available
    ? classify(type, null, detectViewerOs()) === 'render'
    : classifyForBrowser(type, navigator.userAgent) === 'render'
  return t(shown ? 'messenger.ipfsOpen' : 'messenger.ipfsDownload')
})

function open(): void {
  void openIpfsViewer(props.link.target, props.link.secret)
}

const canSeed = computed(() => ipfs.available && !props.mine && !!auth.address)
const seeding = ref(false)
const seededHere = ref(false)
const seeded = computed(
  () => seededHere.value || ipfs.shares.some((s) => s.cid === props.link.target.root)
)

function seed(): void {
  // Под Tor IPFS запрещён целиком: раздача светила бы реальный IP.
  if (ipfs.torActive) {
    ipfs.showTorBlocked()
    return
  }
  Modal.confirm({
    title: t('messenger.ipfsSeedTitle'),
    content: t('messenger.ipfsSeedContent'),
    okText: t('messenger.ipfsSeedOk'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      seeding.value = true
      ipfs.message = null
      try {
        const root = props.link.target.root
        const shared = await ipfs.seed(auth.address ?? '', {
          cid: root,
          name: props.link.name || root.slice(0, 16),
          size: props.link.size ?? 0,
          key: props.link.secret?.key,
        })
        if (shared) {
          seededHere.value = true
          appToast.success({ message: t('messenger.ipfsSeedDone') })
        } else {
          appToast.error({
            message: t('messenger.ipfsSeedFailed'),
            description: ipfs.message ?? '',
          })
        }
      } finally {
        seeding.value = false
      }
    },
  })
}
</script>
