<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.rns.ifaces.title') }}</SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshNote v-if="list.length === 0">{{ t('mesh.rns.ifaces.empty') }}</SC_MeshNote>
    <SC_MeshList v-else>
      <SC_MeshItem v-for="(i, index) in list" :key="index">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ title(i) }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ meta(i) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <Button size="small" danger @click="remove(index)">{{ t('mesh.channels.remove') }}</Button>
      </SC_MeshItem>
    </SC_MeshList>

    <label>
      <input :checked="hasLan" type="checkbox" @change="toggleLan" />
      {{ t('mesh.rns.ifaces.lan') }}
    </label>
    <SC_MeshNote>{{ t('mesh.rns.ifaces.lanHint') }}</SC_MeshNote>

    <SC_MeshSubtitle>{{ t('mesh.rns.ifaces.hub') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.rns.ifaces.hubHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="addHub">
      <SC_MeshField>
        {{ t('mesh.connect.host') }}
        <SC_MeshInput v-model="host" autocomplete="off" spellcheck="false" />
      </SC_MeshField>
      <SC_MeshFieldNarrow>
        {{ t('mesh.connect.port') }}
        <SC_MeshInput v-model="port" inputmode="numeric" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <Button html-type="submit" :disabled="!hubValid">{{ t('mesh.channels.add') }}</Button>
    </SC_MeshForm>

    <SC_MeshSubtitle>{{ t('mesh.rns.ifaces.rnode') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.rns.ifaces.rnodeHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="addRnode">
      <SC_MeshField>
        {{ t('mesh.rns.ifaces.serialPort') }}
        <SC_MeshSelect v-model="rnodePort" @focus="loadPorts">
          <option value="" disabled>{{ t('mesh.rns.ifaces.choosePort') }}</option>
          <option v-for="p in ports" :key="p.path" :value="p.path">{{ portTitle(p) }}</option>
        </SC_MeshSelect>
      </SC_MeshField>
      <SC_MeshFieldNarrow>
        {{ t('mesh.rns.ifaces.frequency') }}
        <SC_MeshInput v-model="frequency" inputmode="decimal" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <SC_MeshFieldNarrow>
        {{ t('mesh.rns.ifaces.bandwidth') }}
        <SC_MeshInput v-model="bandwidth" inputmode="numeric" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <SC_MeshFieldNarrow>
        SF
        <SC_MeshInput v-model="sf" inputmode="numeric" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <SC_MeshFieldNarrow>
        CR
        <SC_MeshInput v-model="cr" inputmode="numeric" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <SC_MeshFieldNarrow>
        {{ t('mesh.rns.ifaces.txPower') }}
        <SC_MeshInput v-model="txPower" inputmode="numeric" autocomplete="off" />
      </SC_MeshFieldNarrow>
      <Button html-type="submit" :disabled="!rnodeValid">{{ t('mesh.channels.add') }}</Button>
    </SC_MeshForm>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Интерфейсы Reticulum: хабы сообщества по TCP, локальная сеть, RNode по USB. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { listSerialPorts } from '@/mesh/radio/platform'
import type { SerialPortInfo } from '@/mesh/radio/types'
import type { RnsInterface } from '@/mesh/reticulum/rns-api'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { portTitle, useMeshAction } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshField,
  SC_MeshFieldNarrow,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshSelect,
  SC_MeshSubtitle,
} from './mesh-page.styled'

const { t } = useI18n()
const rns = useReticulumStore()
const { config } = storeToRefs(rns)
const act = useMeshAction()

const list = computed(() => config.value.interfaces)
const hasLan = computed(() => list.value.some((i) => i.kind === 'auto'))

function title(i: RnsInterface): string {
  if (i.kind === 'tcp') return `${i.host}:${i.port}`
  if (i.kind === 'auto') return t('mesh.rns.ifaces.lan')
  return `RNode · ${i.port}`
}

function meta(i: RnsInterface): string {
  if (i.kind === 'tcp') return t('mesh.rns.ifaces.hubKind')
  if (i.kind === 'auto') return t('mesh.rns.ifaces.lanKind')
  return `${(i.frequency / 1e6).toFixed(3)} MHz · ${i.bandwidth / 1000} kHz · SF${i.spreadingFactor} · CR${i.codingRate} · ${i.txPower} dBm`
}

async function save(next: RnsInterface[]): Promise<void> {
  await act(() => rns.updateConfig({ interfaces: next }))
}

async function remove(index: number): Promise<void> {
  await save(list.value.filter((_, i) => i !== index))
}

async function toggleLan(): Promise<void> {
  await save(
    hasLan.value
      ? list.value.filter((i) => i.kind !== 'auto')
      : [...list.value, { kind: 'auto' as const }]
  )
}

// Хаб сообщества
const host = ref('')
const port = ref('4242')
const hubValid = computed(() => {
  const p = Number(port.value)
  return host.value.trim().length > 0 && Number.isInteger(p) && p > 0 && p < 65536
})

async function addHub(): Promise<void> {
  if (!hubValid.value) return
  await save([...list.value, { kind: 'tcp', host: host.value.trim(), port: Number(port.value) }])
  host.value = ''
}

// RNode: значения по умолчанию — частая настройка сообществ в 868 МГц.
const ports = ref<SerialPortInfo[]>([])
const rnodePort = ref('')
const frequency = ref('869.525')
const bandwidth = ref('125')
const sf = ref('8')
const cr = ref('5')
const txPower = ref('14')

async function loadPorts(): Promise<void> {
  try {
    ports.value = await listSerialPorts()
  } catch {
    ports.value = []
  }
}

const rnodeValid = computed(() => {
  const f = Number(frequency.value)
  const bw = Number(bandwidth.value)
  const s = Number(sf.value)
  const c = Number(cr.value)
  const tx = Number(txPower.value)
  return (
    rnodePort.value !== '' &&
    f > 100 &&
    f < 3000 &&
    bw > 0 &&
    s >= 5 &&
    s <= 12 &&
    c >= 5 &&
    c <= 8 &&
    Number.isInteger(tx) &&
    tx >= 0 &&
    tx <= 30
  )
})

async function addRnode(): Promise<void> {
  if (!rnodeValid.value) return
  await save([
    ...list.value,
    {
      kind: 'rnode',
      port: rnodePort.value,
      frequency: Math.round(Number(frequency.value) * 1e6),
      bandwidth: Math.round(Number(bandwidth.value) * 1000),
      spreadingFactor: Number(sf.value),
      codingRate: Number(cr.value),
      txPower: Number(txPower.value),
    },
  ])
}
</script>
