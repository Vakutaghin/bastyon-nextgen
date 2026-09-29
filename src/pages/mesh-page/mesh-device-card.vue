<template>
  <SC_MeshCard v-if="self">
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ self.name || t('mesh.device.unnamed') }}</SC_MeshCardTitle>
      <Button @click="disconnect">{{ t('mesh.device.disconnect') }}</Button>
    </SC_MeshCardHead>

    <SC_MeshProps>
      <dt>{{ t('mesh.device.connection') }}</dt>
      <dd>{{ transportText }} · {{ label }}</dd>
      <template v-if="device?.model">
        <dt>{{ t('mesh.device.model') }}</dt>
        <dd>{{ device.model }}</dd>
      </template>
      <template v-if="device?.version">
        <dt>{{ t('mesh.device.firmware') }}</dt>
        <dd>{{ device.version }}</dd>
      </template>
      <dt>{{ t('mesh.device.radio') }}</dt>
      <dd>
        {{
          t('mesh.device.radioValue', { freq: self.radioFreq, bw: self.radioBw, sf: self.radioSf })
        }}
      </dd>
      <template v-if="battery">
        <dt>{{ t('mesh.device.battery') }}</dt>
        <dd>
          {{ t('mesh.device.batteryValue', { volts: (battery.millivolts / 1000).toFixed(2) }) }}
        </dd>
      </template>
      <dt>{{ t('mesh.device.key') }}</dt>
      <dd>
        <SC_MeshRow>
          <SC_MeshMono :title="self.publicKey">{{ self.publicKey.slice(0, 16) }}…</SC_MeshMono>
          <SC_MeshLinkButton type="button" @click="copyKey">
            {{ t('mesh.device.copyKey') }}
          </SC_MeshLinkButton>
        </SC_MeshRow>
      </dd>
    </SC_MeshProps>

    <SC_MeshForm @submit.prevent="saveName">
      <SC_MeshField>
        {{ t('mesh.device.name') }}
        <SC_MeshInput v-model="name" maxlength="31" autocomplete="off" />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!nameChanged">{{ t('mesh.device.rename') }}</Button>
    </SC_MeshForm>

    <SC_MeshRow>
      <Button @click="advert(false)">{{ t('mesh.device.advert') }}</Button>
      <Button @click="advert(true)">{{ t('mesh.device.advertFlood') }}</Button>
    </SC_MeshRow>
    <SC_MeshNote>{{ t('mesh.device.advertHint') }}</SC_MeshNote>
  </SC_MeshCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { utf8Length } from '@/mesh/bytes'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshAction } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshField,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshLinkButton,
  SC_MeshMono,
  SC_MeshNote,
  SC_MeshProps,
  SC_MeshRow,
} from './mesh-page.styled'

const { t } = useI18n()
const connection = useMeshConnectionStore()
const { self, device, battery, label, target } = storeToRefs(connection)
const act = useMeshAction()

const transportText = computed<string>(() => {
  const kind = target.value?.transport
  if (kind === 'ble') return t('mesh.connect.bluetooth')
  if (kind === 'tcp') return t('mesh.connect.wifi')
  return t('mesh.connect.usb')
})

const name = ref(self.value?.name ?? '')
watch(
  () => self.value?.name,
  (value) => {
    name.value = value ?? ''
  }
)
const nameChanged = computed(() => {
  const next = name.value.trim()
  // Имя узла — до 31 байта: так его хранит прошивка.
  return next.length > 0 && next !== self.value?.name && utf8Length(next) <= 31
})

async function saveName(): Promise<void> {
  if (!nameChanged.value) return
  await act(() => connection.rename(name.value.trim()), t('mesh.device.renamed'))
}

async function advert(flood: boolean): Promise<void> {
  await act(() => connection.sendAdvert(flood), t('mesh.device.advertSent'))
}

async function disconnect(): Promise<void> {
  await connection.disconnect()
}

async function copyKey(): Promise<void> {
  const key = self.value?.publicKey
  if (!key) return
  try {
    await navigator.clipboard.writeText(key)
    appToast.success({ message: t('mesh.device.keyCopied') })
  } catch {
    appToast.error({ message: t('mesh.errors.generic', { code: 'clipboard' }) })
  }
}
</script>
