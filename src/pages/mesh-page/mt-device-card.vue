<template>
  <SC_MeshCard v-if="self">
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ self.longName || self.id }}</SC_MeshCardTitle>
      <Button @click="disconnect">{{ t('mesh.device.disconnect') }}</Button>
    </SC_MeshCardHead>

    <template v-if="regionUnset">
      <SC_MeshWarn>{{ t('mesh.mt.region.lead') }}</SC_MeshWarn>
    </template>

    <SC_MeshProps>
      <dt>{{ t('mesh.mt.device.id') }}</dt>
      <dd>
        <SC_MeshMono>{{ self.id }}</SC_MeshMono>
      </dd>
      <dt>{{ t('mesh.device.connection') }}</dt>
      <dd>{{ transportText }} · {{ label }}</dd>
      <template v-if="self.hwModelName">
        <dt>{{ t('mesh.device.model') }}</dt>
        <dd>{{ self.hwModelName }}</dd>
      </template>
      <template v-if="metadata?.firmwareVersion">
        <dt>{{ t('mesh.device.firmware') }}</dt>
        <dd>{{ metadata.firmwareVersion }}</dd>
      </template>
      <dt>{{ t('mesh.device.radio') }}</dt>
      <dd>{{ radioText }}</dd>
      <template v-if="batteryText">
        <dt>{{ t('mesh.device.battery') }}</dt>
        <dd>{{ batteryText }}</dd>
      </template>
      <dt>{{ t('mesh.device.key') }}</dt>
      <dd>
        <SC_MeshRow v-if="self.publicKey">
          <SC_MeshMono :title="self.publicKey">{{ self.publicKey.slice(0, 16) }}…</SC_MeshMono>
          <SC_MeshLinkButton
            type="button"
            @click="copy(self.publicKey, t('mesh.device.keyCopied'))"
          >
            {{ t('mesh.device.copyKey') }}
          </SC_MeshLinkButton>
        </SC_MeshRow>
        <template v-else>{{ t('mesh.mt.device.noKey') }}</template>
      </dd>
    </SC_MeshProps>

    <SC_MeshSubtitle>{{ t('mesh.mt.device.radioSettings') }}</SC_MeshSubtitle>
    <SC_MeshForm @submit.prevent="applyRadio">
      <SC_MeshField>
        {{ t('mesh.mt.device.region') }}
        <SC_MeshSelect v-model.number="region">
          <option v-if="regionUnset" :value="0" disabled>{{ t('mesh.mt.region.choose') }}</option>
          <option v-for="r in regions" :key="r.code" :value="r.code">{{ r.label }}</option>
        </SC_MeshSelect>
      </SC_MeshField>
      <SC_MeshField>
        {{ t('mesh.mt.device.preset') }}
        <SC_MeshSelect v-model.number="preset">
          <option v-for="p in MODEM_PRESETS" :key="p.code" :value="p.code">{{ p.name }}</option>
        </SC_MeshSelect>
      </SC_MeshField>
      <Button type="primary" html-type="submit" :disabled="!radioChanged" :loading="applying">
        {{ t('mesh.mt.device.apply') }}
      </Button>
    </SC_MeshForm>
    <SC_MeshNote>{{ t('mesh.mt.device.presetHint') }}</SC_MeshNote>

    <SC_MeshSubtitle>{{ t('mesh.device.name') }}</SC_MeshSubtitle>
    <SC_MeshForm @submit.prevent="saveName">
      <SC_MeshField>
        {{ t('mesh.mt.device.longName') }}
        <SC_MeshInput v-model="longName" autocomplete="off" />
      </SC_MeshField>
      <SC_MeshFieldNarrow>
        {{ t('mesh.mt.device.shortName') }}
        <SC_MeshInput v-model="shortName" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <Button html-type="submit" :disabled="!nameChanged">{{ t('mesh.device.rename') }}</Button>
    </SC_MeshForm>
    <SC_MeshNote>{{ t('mesh.mt.device.nameHint') }}</SC_MeshNote>

    <SC_MeshWarn v-if="notice">
      {{ t('mesh.mt.device.notice', { text: notice }) }}
      <SC_MeshLinkButton type="button" @click="dismissNotice">
        {{ t('mesh.mt.device.dismiss') }}
      </SC_MeshLinkButton>
    </SC_MeshWarn>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Своё радио Meshtastic: сведения, регион и пресет, имя узла. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { utf8Length } from '@/mesh/bytes'
import {
  MAX_LONG_NAME_BYTES,
  MAX_SHORT_NAME_BYTES,
  MODEM_PRESETS,
  presetName,
  REGION_CHOICES,
} from '@/mesh/meshtastic/constants'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useCopy, useMeshAction } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshField,
  SC_MeshFieldNarrow,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshLinkButton,
  SC_MeshMono,
  SC_MeshNote,
  SC_MeshProps,
  SC_MeshRow,
  SC_MeshSelect,
  SC_MeshSubtitle,
  SC_MeshWarn,
} from './mesh-page.styled'

const { t, te } = useI18n()
const connection = useMeshtasticConnectionStore()
const { self, metadata, lora, battery, label, target, regionUnset, notice } =
  storeToRefs(connection)
const act = useMeshAction()
const copy = useCopy()

const transportText = computed<string>(() => {
  const kind = target.value?.transport
  if (kind === 'ble') return t('mesh.connect.bluetooth')
  if (kind === 'tcp') return t('mesh.connect.wifi')
  return t('mesh.connect.usb')
})

function regionLabel(id: string): string {
  const key = `mesh.mt.region.names.${id}`
  return te(key) ? t(key) : id
}

const regions = computed(() =>
  REGION_CHOICES.map((r) => ({ code: r.code, label: regionLabel(r.id) }))
)

const radioText = computed<string>(() => {
  const l = lora.value
  if (!l) return '—'
  const region = REGION_CHOICES.find((r) => r.code === l.region)
  const regionText =
    l.region === 0 ? t('mesh.mt.region.unset') : regionLabel(region?.id ?? String(l.region))
  return `${regionText} · ${l.usePreset ? presetName(l.modemPreset) : 'Custom'}`
})

const batteryText = computed<string>(() => {
  const level = battery.value?.level
  if (level === null || level === undefined) return ''
  // 101 — прошивка так сообщает о питании от сети.
  return level > 100 ? t('mesh.mt.device.powered') : `${level}%`
})

const region = ref(lora.value?.region ?? 0)
const preset = ref(lora.value?.modemPreset ?? 0)
watch(lora, (l) => {
  region.value = l?.region ?? 0
  preset.value = l?.modemPreset ?? 0
})
const radioChanged = computed(
  () =>
    region.value !== 0 &&
    (region.value !== lora.value?.region || preset.value !== lora.value?.modemPreset)
)
const applying = ref(false)

async function applyRadio(): Promise<void> {
  if (!radioChanged.value) return
  applying.value = true
  try {
    await act(
      () => connection.setRadio({ region: region.value, modemPreset: preset.value }),
      t('mesh.mt.device.applied')
    )
  } finally {
    applying.value = false
  }
}

const longName = ref(self.value?.longName ?? '')
const shortName = ref(self.value?.shortName ?? '')
watch(self, (s) => {
  longName.value = s?.longName ?? ''
  shortName.value = s?.shortName ?? ''
})
const nameChanged = computed(() => {
  const l = longName.value.trim()
  const s = shortName.value.trim()
  if (!l || !s) return false
  if (utf8Length(l) > MAX_LONG_NAME_BYTES || utf8Length(s) > MAX_SHORT_NAME_BYTES) return false
  return l !== self.value?.longName || s !== self.value?.shortName
})

async function saveName(): Promise<void> {
  if (!nameChanged.value) return
  await act(
    () => connection.rename(longName.value.trim(), shortName.value.trim()),
    t('mesh.device.renamed')
  )
}

async function disconnect(): Promise<void> {
  await connection.disconnect()
}

function dismissNotice(): void {
  connection.dismissNotice()
}
</script>
