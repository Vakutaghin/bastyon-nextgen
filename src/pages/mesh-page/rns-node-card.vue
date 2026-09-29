<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.rns.node.title') }}</SC_MeshCardTitle>
      <Button v-if="status === 'running'" @click="rns.stop()">{{ t('mesh.rns.node.stop') }}</Button>
      <Button v-else type="primary" :loading="status === 'starting'" @click="start">
        {{ t('mesh.rns.node.start') }}
      </Button>
    </SC_MeshCardHead>

    <SC_MeshNote>{{ t('mesh.rns.node.lead') }}</SC_MeshNote>
    <SC_MeshWarn v-if="tor">{{ t('mesh.rns.node.torNote') }}</SC_MeshWarn>
    <SC_MeshError v-if="errorText" role="alert">{{ errorText }}</SC_MeshError>

    <SC_MeshProps v-if="status === 'running' && address">
      <dt>{{ t('mesh.rns.node.address') }}</dt>
      <dd>
        <SC_MeshRow>
          <SC_MeshMono :title="address">{{ address }}</SC_MeshMono>
          <SC_MeshLinkButton type="button" @click="copy(address, t('mesh.rns.node.addressCopied'))">
            {{ t('mesh.device.copyKey') }}
          </SC_MeshLinkButton>
        </SC_MeshRow>
      </dd>
      <dt>{{ t('mesh.rns.node.interfaces') }}</dt>
      <dd>{{ interfacesText }}</dd>
    </SC_MeshProps>

    <SC_MeshForm @submit.prevent="saveName">
      <SC_MeshField>
        {{ t('mesh.rns.node.name') }}
        <SC_MeshInput v-model="name" maxlength="64" autocomplete="off" />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!nameChanged">{{ t('mesh.device.rename') }}</Button>
      <Button v-if="status === 'running'" @click="announce">
        {{ t('mesh.rns.node.announce') }}
      </Button>
    </SC_MeshForm>
    <SC_MeshNote>{{ t('mesh.rns.node.announceHint') }}</SC_MeshNote>

    <label>
      <input v-model="autostart" type="checkbox" />
      {{ t('mesh.rns.node.autostart') }}
    </label>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Свой узел Reticulum: запуск, адрес LXMF для собеседников, имя в announce. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { useTorStore } from '@/stores/tor-store'
import { useCopy, useMeshAction, useMeshErrorText } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshError,
  SC_MeshField,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshLinkButton,
  SC_MeshMono,
  SC_MeshNote,
  SC_MeshProps,
  SC_MeshRow,
  SC_MeshWarn,
} from './mesh-page.styled'

const { t } = useI18n()
const rns = useReticulumStore()
const { status, address, config, interfaces, error } = storeToRefs(rns)
const act = useMeshAction()
const copy = useCopy()
const errorLabel = useMeshErrorText()
const tor = computed(() => useTorStore().enabled)

const errorText = computed(() => errorLabel(error.value))

const interfacesText = computed(() => {
  if (interfaces.value.length === 0) return t('mesh.rns.node.noInterfaces')
  const online = interfaces.value.filter((i) => i.online).length
  return t('mesh.rns.node.interfacesValue', { online, total: interfaces.value.length })
})

async function start(): Promise<void> {
  await rns.start()
}

const name = ref(config.value.displayName)
watch(
  () => config.value.displayName,
  (v) => {
    name.value = v
  }
)
const nameChanged = computed(() => {
  const v = name.value.trim()
  return v.length > 0 && v !== config.value.displayName
})

async function saveName(): Promise<void> {
  if (!nameChanged.value) return
  await act(() => rns.updateConfig({ displayName: name.value.trim() }), t('mesh.device.renamed'))
}

async function announce(): Promise<void> {
  await act(() => rns.announce(), t('mesh.device.advertSent'))
}

const autostart = computed({
  get: () => config.value.autostart,
  set: (v: boolean) => void rns.updateConfig({ autostart: v }),
})
</script>
