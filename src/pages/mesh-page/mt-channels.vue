<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.channels.title') }}</SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshNote v-if="channels.length === 0">{{ t('mesh.channels.empty') }}</SC_MeshNote>
    <SC_MeshList v-else>
      <SC_MeshItem v-for="c in channels" :key="c.index">
        <SC_MeshItemMain>
          <SC_MeshItemName>
            {{ c.name }}
            <SC_MeshBadge v-if="c.role === 'primary'">{{
              t('mesh.mt.channels.primary')
            }}</SC_MeshBadge>
          </SC_MeshItemName>
          <SC_MeshItemMeta>{{ kindText(c) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <SC_MeshItemActions>
          <Button size="small" type="primary" @click="openMtChannel(c)">
            {{ t('mesh.channels.open') }}
          </Button>
          <Button size="small" @click="share(c)">{{ t('mesh.mt.channels.share') }}</Button>
          <Button v-if="c.role !== 'primary'" size="small" danger @click="confirmRemove(c)">
            {{ t('mesh.channels.remove') }}
          </Button>
        </SC_MeshItemActions>
      </SC_MeshItem>
    </SC_MeshList>

    <SC_MeshSubtitle>{{ t('mesh.channels.addPrivate') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.mt.channels.privateHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="create">
      <SC_MeshField>
        {{ t('mesh.channels.name') }}
        <SC_MeshInput
          v-model="name"
          :placeholder="t('mesh.mt.channels.namePlaceholder')"
          autocomplete="off"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!nameValid">{{ t('mesh.mt.channels.create') }}</Button>
    </SC_MeshForm>

    <SC_MeshSubtitle>{{ t('mesh.mt.channels.addLink') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.mt.channels.linkHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="addFromLink">
      <SC_MeshField>
        <SC_MeshInput
          v-model="link"
          placeholder="https://meshtastic.org/e/#…"
          autocomplete="off"
          spellcheck="false"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!linkValid">{{ t('mesh.channels.add') }}</Button>
    </SC_MeshForm>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Каналы радио Meshtastic: основной и до семи дополнительных. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button, Modal } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { utf8Length } from '@/mesh/bytes'
import { randomPsk } from '@/mesh/meshtastic/channels'
import { MAX_CHANNEL_NAME_BYTES } from '@/mesh/meshtastic/constants'
import type { MtSessionChannel } from '@/mesh/meshtastic/session'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useCopy, useMeshAction, useMeshOpenChat } from './use-mesh-page'
import {
  SC_MeshBadge,
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshField,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemActions,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshSubtitle,
} from './mesh-page.styled'

const { t } = useI18n()
const connection = useMeshtasticConnectionStore()
const { channels } = storeToRefs(connection)
const act = useMeshAction()
const copy = useCopy()
const { openMtChannel } = useMeshOpenChat()

function kindText(c: MtSessionChannel): string {
  if (c.unencrypted) return t('mesh.mt.channels.kind.unencrypted')
  return t(`mesh.mt.channels.kind.${c.kind}`)
}

async function share(c: MtSessionChannel): Promise<void> {
  const url = connection.channelUrl(c.index)
  if (url) await copy(url, t('mesh.mt.channels.linkCopied'))
}

const name = ref('')
// Имя канала на радио — до 11 байт, без пробелов по краям.
const nameValid = computed(() => {
  const n = name.value.trim()
  return n.length > 0 && utf8Length(n) <= MAX_CHANNEL_NAME_BYTES
})

async function create(): Promise<void> {
  if (!nameValid.value) return
  const ok = await act(
    () => connection.addChannel(name.value.trim(), randomPsk()),
    t('mesh.mt.channels.created')
  )
  if (ok) name.value = ''
}

const link = ref('')
const linkValid = computed(() => /meshtastic\.org\/e\/.*#/i.test(link.value.trim()))

async function addFromLink(): Promise<void> {
  if (!linkValid.value) return
  let added = 0
  const ok = await act(async () => {
    added = await connection.addChannelsFromUrl(link.value.trim())
  })
  if (!ok) return
  link.value = ''
  if (added > 0) appToast.success({ message: t('mesh.mt.channels.linkAdded', { n: added }, added) })
  else appToast.info({ message: t('mesh.mt.channels.linkNothing') })
}

function confirmRemove(c: MtSessionChannel): void {
  Modal.confirm({
    title: t('mesh.channels.removeConfirm', { name: c.name }),
    content: t('mesh.channels.removeHint'),
    okText: t('mesh.channels.remove'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    onOk: () => act(() => connection.removeChannel(c.index)),
  })
}
</script>
