<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.connect.title') }}</SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshRow v-if="lastDevice && status === 'idle'">
      <SC_MeshNote>{{
        t('mesh.connect.lastDevice', { name: targetLabel(lastDevice) })
      }}</SC_MeshNote>
      <Button type="primary" :loading="busy" @click="connectTo(lastDevice)">
        {{ t('mesh.connect.connect') }}
      </Button>
    </SC_MeshRow>

    <SC_MeshNote v-if="status === 'reconnecting'">{{ t('mesh.status.reconnecting') }}</SC_MeshNote>

    <SC_MeshTabs role="tablist">
      <SC_MeshTab
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :active="transport === tab.id"
        :aria-selected="transport === tab.id"
        @click="transport = tab.id"
      >
        <component :is="tab.icon" />
        {{ tab.label }}
      </SC_MeshTab>
    </SC_MeshTabs>

    <template v-if="transport === 'serial'">
      <SC_MeshRow>
        <SC_MeshNote>{{ t('mesh.connect.usbLead') }}</SC_MeshNote>
        <Button size="small" @click="refreshPorts">{{ t('mesh.connect.refresh') }}</Button>
      </SC_MeshRow>
      <SC_MeshNote v-if="portsLoaded && ports.length === 0">{{
        t('mesh.connect.noPorts')
      }}</SC_MeshNote>
      <SC_MeshList v-if="usbPorts.length > 0">
        <SC_MeshItem v-for="p in usbPorts" :key="p.path">
          <SC_MeshItemIcon><UsbIcon /></SC_MeshItemIcon>
          <SC_MeshItemMain>
            <SC_MeshItemName>{{ portTitle(p) }}</SC_MeshItemName>
            <SC_MeshItemMeta>{{ p.path }}</SC_MeshItemMeta>
          </SC_MeshItemMain>
          <Button :loading="busy" @click="connectSerial(p)">{{ t('mesh.connect.connect') }}</Button>
        </SC_MeshItem>
      </SC_MeshList>
      <SC_MeshDetails v-if="otherPorts.length > 0">
        <summary>{{ t('mesh.connect.otherPorts', { n: otherPorts.length }) }}</summary>
        <SC_MeshList>
          <SC_MeshItem v-for="p in otherPorts" :key="p.path">
            <SC_MeshItemMain>
              <SC_MeshItemName>{{ p.path }}</SC_MeshItemName>
            </SC_MeshItemMain>
            <Button size="small" :loading="busy" @click="connectSerial(p)">
              {{ t('mesh.connect.connect') }}
            </Button>
          </SC_MeshItem>
        </SC_MeshList>
      </SC_MeshDetails>
    </template>

    <template v-else-if="transport === 'ble'">
      <SC_MeshRow>
        <Button :loading="scanning" @click="scan(false)">
          {{ scanning ? t('mesh.connect.scanning') : t('mesh.connect.scan') }}
        </Button>
        <SC_MeshLinkButton v-if="scanned && !scanning" type="button" @click="scan(true)">
          {{ t('mesh.connect.scanAll') }}
        </SC_MeshLinkButton>
      </SC_MeshRow>
      <SC_MeshNote v-if="scanned && !scanning && devices.length === 0">
        {{ t('mesh.connect.noDevices') }}
      </SC_MeshNote>
      <SC_MeshList v-if="devices.length > 0">
        <SC_MeshItem v-for="d in devices" :key="d.id">
          <SC_MeshItemIcon><BluetoothIcon /></SC_MeshItemIcon>
          <SC_MeshItemMain>
            <SC_MeshItemName>{{ d.name || t('mesh.connect.unnamed') }}</SC_MeshItemName>
            <SC_MeshItemMeta>
              {{ d.rssi !== null ? t('mesh.connect.signal', { rssi: d.rssi }) : d.id }}
            </SC_MeshItemMeta>
          </SC_MeshItemMain>
          <Button :loading="busy" @click="connectBle(d)">{{ t('mesh.connect.connect') }}</Button>
        </SC_MeshItem>
      </SC_MeshList>
      <SC_MeshNote>{{ t('mesh.connect.pinHint') }}</SC_MeshNote>
    </template>

    <template v-else>
      <SC_MeshForm @submit.prevent="connectTcp">
        <SC_MeshField>
          {{ t('mesh.connect.host') }}
          <SC_MeshInput
            v-model="host"
            placeholder="192.168.4.1"
            autocomplete="off"
            spellcheck="false"
          />
        </SC_MeshField>
        <SC_MeshFieldNarrow>
          {{ t('mesh.connect.port') }}
          <SC_MeshInput v-model="port" inputmode="numeric" autocomplete="off" />
        </SC_MeshFieldNarrow>
        <Button type="primary" html-type="submit" :loading="busy" :disabled="!tcpValid">
          {{ t('mesh.connect.connect') }}
        </Button>
      </SC_MeshForm>
      <SC_MeshNote>{{ t('mesh.connect.hostHint', { port: defaultPort }) }}</SC_MeshNote>
      <SC_MeshWarn>{{ t('mesh.connect.lanWarning') }}</SC_MeshWarn>
    </template>

    <SC_MeshError v-if="connectionError" role="alert">{{ connectionError }}</SC_MeshError>
  </SC_MeshCard>
</template>

<script setup lang="ts">
import { computed, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { BluetoothIcon, UsbIcon, WifiIcon } from '@/components/icons'
import type { MeshNetwork } from '@/mesh/ids'
import { portTitle, useMeshConnect, type TransportTab } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshDetails,
  SC_MeshError,
  SC_MeshField,
  SC_MeshFieldNarrow,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemIcon,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshLinkButton,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshRow,
  SC_MeshTab,
  SC_MeshTabs,
  SC_MeshWarn,
} from './mesh-page.styled'

const props = defineProps<{ network: MeshNetwork }>()

const { t } = useI18n()
const {
  status,
  lastDevice,
  transport,
  busy,
  ports,
  portsLoaded,
  usbPorts,
  otherPorts,
  refreshPorts,
  devices,
  scanning,
  scanned,
  scan,
  host,
  port,
  tcpValid,
  connectTo,
  connectSerial,
  connectBle,
  connectTcp,
  defaultPort,
  targetLabel,
  connectionError,
} = useMeshConnect(props.network)

const tabs = computed<Array<{ id: TransportTab; label: string; icon: Component }>>(() => [
  { id: 'serial', label: t('mesh.connect.usb'), icon: UsbIcon },
  { id: 'ble', label: t('mesh.connect.bluetooth'), icon: BluetoothIcon },
  { id: 'tcp', label: t('mesh.connect.wifi'), icon: WifiIcon },
])

onMounted(() => {
  void refreshPorts()
})
</script>
