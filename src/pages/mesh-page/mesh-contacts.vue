<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>
        {{ t('mesh.contacts.title') }}
        <SC_MeshCount>{{ contacts.length }}</SC_MeshCount>
      </SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshWarn v-if="contactsFull">{{ t('mesh.contacts.full') }}</SC_MeshWarn>
    <SC_MeshNote v-if="contacts.length === 0">{{ t('mesh.contacts.empty') }}</SC_MeshNote>

    <SC_MeshList v-else>
      <SC_MeshItem v-for="c in contacts" :key="c.publicKey">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ c.name || c.publicKey.slice(0, 8) }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ describe(c) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <SC_MeshItemActions>
          <Button v-if="canWrite(c)" size="small" type="primary" @click="writeTo(c)">
            {{ t('mesh.contacts.write') }}
          </Button>
          <Button size="small" danger @click="confirmRemove(c)">{{
            t('mesh.contacts.remove')
          }}</Button>
        </SC_MeshItemActions>
      </SC_MeshItem>
    </SC_MeshList>

    <template v-if="discovered.length > 0">
      <SC_MeshSubtitle>{{ t('mesh.contacts.discovered') }}</SC_MeshSubtitle>
      <SC_MeshNote>{{ t('mesh.contacts.discoveredHint') }}</SC_MeshNote>
      <SC_MeshList>
        <SC_MeshItem v-for="c in discovered" :key="c.publicKey">
          <SC_MeshItemMain>
            <SC_MeshItemName>{{ c.name || c.publicKey.slice(0, 8) }}</SC_MeshItemName>
            <SC_MeshItemMeta>{{ kindText(c.type) }}</SC_MeshItemMeta>
          </SC_MeshItemMain>
          <Button size="small" @click="add(c)">{{ t('mesh.contacts.add') }}</Button>
        </SC_MeshItem>
      </SC_MeshList>
    </template>
  </SC_MeshCard>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button, Modal } from 'ant-design-vue'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import type { McContact } from '@/mesh/meshcore/codec'
import { hopCount } from '@/mesh/meshcore/codec'
import { ADV_TYPE } from '@/mesh/meshcore/constants'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshAction, useMeshOpenChat } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshCount,
  SC_MeshItem,
  SC_MeshItemActions,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshSubtitle,
  SC_MeshWarn,
} from './mesh-page.styled'

const { t } = useI18n()
const connection = useMeshConnectionStore()
const { contacts, discovered, contactsFull } = storeToRefs(connection)
const act = useMeshAction()
const { writeTo } = useMeshOpenChat()

const KIND_KEYS: Record<number, string> = {
  [ADV_TYPE.CHAT]: 'chat',
  [ADV_TYPE.REPEATER]: 'repeater',
  [ADV_TYPE.ROOM]: 'room',
  [ADV_TYPE.SENSOR]: 'sensor',
}

function kindText(type: number): string {
  return t(`mesh.contacts.kind.${KIND_KEYS[type] ?? 'other'}`)
}

/** Переписываться можно с собеседником и комнатой; репитер и датчик не отвечают. */
function canWrite(c: McContact): boolean {
  return c.type === ADV_TYPE.CHAT || c.type === ADV_TYPE.ROOM
}

function describe(c: McContact): string {
  const hops = hopCount(c.outPathLen)
  const route =
    hops === null
      ? t('mesh.contacts.flood')
      : hops === 0
        ? t('mesh.contacts.direct')
        : t('mesh.contacts.hops', { n: hops }, hops)
  const parts = [kindText(c.type), route]
  // Когда радио последний раз слышало узел — по его собственным часам.
  if (c.lastMod > 0) parts.push(t('mesh.contacts.heard', { time: formatTimeAgo(c.lastMod) }))
  return parts.join(' · ')
}

function confirmRemove(c: McContact): void {
  Modal.confirm({
    title: t('mesh.contacts.removeConfirm', { name: c.name || c.publicKey.slice(0, 8) }),
    content: t('mesh.contacts.removeHint'),
    okText: t('mesh.contacts.remove'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    onOk: () => act(() => connection.removeContact(c.publicKey)),
  })
}

async function add(c: McContact): Promise<void> {
  await act(() => connection.addDiscovered(c))
}
</script>
