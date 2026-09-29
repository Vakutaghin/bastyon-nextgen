<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.channels.title') }}</SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshNote v-if="channels.length === 0">{{ t('mesh.channels.empty') }}</SC_MeshNote>
    <SC_MeshList v-else>
      <SC_MeshItem v-for="c in channels" :key="c.id">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ c.name || t('mesh.channels.unnamed') }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ t(`mesh.channels.kind.${c.kind}`) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <SC_MeshItemActions>
          <Button size="small" type="primary" @click="openChannel(c)">
            {{ t('mesh.channels.open') }}
          </Button>
          <Button v-if="c.kind === 'private'" size="small" @click="copyKey(c.secret)">
            {{ t('mesh.channels.copyKey') }}
          </Button>
          <Button size="small" danger @click="confirmRemove(c)">{{
            t('mesh.channels.remove')
          }}</Button>
        </SC_MeshItemActions>
      </SC_MeshItem>
    </SC_MeshList>

    <SC_MeshSubtitle>{{ t('mesh.channels.addHashtag') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.channels.hashtagHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="addHashtag">
      <SC_MeshField>
        <SC_MeshInput
          v-model="hashtag"
          :placeholder="t('mesh.channels.hashtagPlaceholder')"
          autocomplete="off"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!hashtagValid">{{ t('mesh.channels.add') }}</Button>
    </SC_MeshForm>

    <SC_MeshSubtitle>{{ t('mesh.channels.addPrivate') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.channels.privateHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="addPrivate">
      <SC_MeshField>
        {{ t('mesh.channels.name') }}
        <SC_MeshInput v-model="privateName" maxlength="31" autocomplete="off" />
      </SC_MeshField>
      <SC_MeshField>
        {{ t('mesh.channels.key') }}
        <SC_MeshInput
          v-model="privateKey"
          :placeholder="t('mesh.channels.keyPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!privateValid">{{ t('mesh.channels.add') }}</Button>
    </SC_MeshForm>
  </SC_MeshCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button, Modal } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { utf8Length } from '@/mesh/bytes'
import type { SessionChannel } from '@/mesh/meshcore/session'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshAction, useMeshOpenChat } from './use-mesh-page'
import {
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
const connection = useMeshConnectionStore()
const { channels } = storeToRefs(connection)
const act = useMeshAction()
const { openChannel } = useMeshOpenChat()

const hashtag = ref('')
const privateName = ref('')
const privateKey = ref('')

// Имя канала на радио — до 31 байта.
const hashtagValid = computed(() => {
  const bare = hashtag.value.trim().replace(/^#+/, '')
  return bare.length > 0 && !/\s/.test(bare) && utf8Length(`#${bare}`) <= 31
})
const privateValid = computed(() => {
  const name = privateName.value.trim()
  const key = privateKey.value.trim()
  return name.length > 0 && utf8Length(name) <= 31 && (key === '' || /^[0-9a-fA-F]{32}$/.test(key))
})

async function addHashtag(): Promise<void> {
  if (!hashtagValid.value) return
  const ok = await act(() => connection.addHashtagChannel(hashtag.value))
  if (ok) hashtag.value = ''
}

async function addPrivate(): Promise<void> {
  if (!privateValid.value) return
  const key = privateKey.value.trim()
  const ok = await act(
    () => connection.addPrivateChannel(privateName.value, key || undefined),
    key ? undefined : t('mesh.channels.privateCreated')
  )
  if (ok) {
    privateName.value = ''
    privateKey.value = ''
  }
}

async function copyKey(secret: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(secret)
    appToast.success({ message: t('mesh.channels.keyCopied') })
  } catch {
    appToast.error({ message: t('mesh.errors.generic', { code: 'clipboard' }) })
  }
}

function confirmRemove(c: SessionChannel): void {
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
