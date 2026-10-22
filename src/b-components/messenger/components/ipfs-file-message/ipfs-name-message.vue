<template>
  <SC_FileMessage>
    <SC_FileIcon>
      <LinkIcon />
    </SC_FileIcon>

    <SC_FileBody>
      <SC_FileName :title="link">{{ t('messenger.ipnsCardTitle') }}</SC_FileName>
      <SC_FileMeta>
        <span>{{ t('messenger.ipnsCardMeta') }}</span>
      </SC_FileMeta>
      <SC_IpfsActions>
        <SC_IpfsAction type="button" @click="open">{{ t('messenger.ipfsOpen') }}</SC_IpfsAction>
        <SC_IpfsAction v-if="canFollow" type="button" :disabled="busy" @click="toggle">
          {{ followed ? t('messenger.ipnsUnfollow') : t('messenger.ipnsFollow') }}
        </SC_IpfsAction>
      </SC_IpfsActions>
    </SC_FileBody>
  </SC_FileMessage>
</template>

<script setup lang="ts">
// Сообщение — постоянная ссылка `ipns://k51…`: владелец может перевести её на
// новую версию, поэтому что внутри — видно по «Открыть». Сама карточка в сеть
// не ходит: иначе одно чтение переписки показывало бы IP службе поиска.
// «Следить за обновлениями» — уведомление, когда ссылку переведут
// (ipns-follow-store.ts).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { LinkIcon } from '@/components/icons'
import { openIpfsViewer } from '@/composables/use-ipfs-links'
import { buildNameLink } from '@/helpers/ipfs/ipfs-viewer'
import { useIpnsFollowStore } from '@/stores/ipns-follow-store'
import { BlockedByTorError } from '@/stores/ipns-names-store'
import {
  SC_FileMessage,
  SC_FileIcon,
  SC_FileBody,
  SC_FileName,
  SC_FileMeta,
} from '../file-message/styled'
import { SC_IpfsActions, SC_IpfsAction } from './styled'

const props = defineProps<{
  /** `k51…` */
  name: string
  /** Своя ссылка: следить за ней незачем. */
  mine: boolean
}>()

const { t } = useI18n()
const auth = useAuthStore()
const follow = useIpnsFollowStore()

const link = computed(() => buildNameLink(props.name))
const canFollow = computed(() => !props.mine && !!auth.address)
watch(
  () => auth.address,
  (address) => follow.use(address ?? ''),
  { immediate: true }
)
const followed = computed(() => follow.isFollowed(props.name))
const busy = ref(false)

function open(): void {
  void openIpfsViewer({ namespace: 'ipns', root: props.name, path: '' }, null, null)
}

async function toggle(): Promise<void> {
  if (followed.value) {
    follow.unfollow(props.name)
    return
  }
  busy.value = true
  try {
    await follow.follow(props.name)
    appToast.success({ message: t('messenger.ipnsFollowing') })
  } catch (e) {
    if (!(e instanceof BlockedByTorError)) {
      appToast.error({ message: t('messenger.ipnsFollowFailed'), description: String(e) })
    }
  } finally {
    busy.value = false
  }
}
</script>
