<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>
        {{ t('mesh.mt.nodes.title') }}
        <SC_MeshCount>{{ nodes.length }}</SC_MeshCount>
      </SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshNote v-if="nodes.length === 0">{{ t('mesh.mt.nodes.empty') }}</SC_MeshNote>

    <template v-else>
      <SC_MeshInput
        v-if="nodes.length > 8"
        v-model="query"
        type="search"
        :placeholder="t('mesh.mt.nodes.search')"
        autocomplete="off"
      />
      <SC_MeshList>
        <SC_MeshItem v-for="n in shown" :key="n.num">
          <SC_MeshItemMain>
            <SC_MeshItemName>
              {{ nameOf(n) }}
              <SC_MeshBadge v-if="n.isFavorite">{{ t('mesh.mt.nodes.favorite') }}</SC_MeshBadge>
              <SC_MeshBadge
                v-if="n.user && !n.user.publicKey"
                :title="t('mesh.mt.nodes.noKeyHint')"
              >
                {{ t('mesh.mt.nodes.noKey') }}
              </SC_MeshBadge>
            </SC_MeshItemName>
            <SC_MeshItemMeta>{{ describe(n) }}</SC_MeshItemMeta>
          </SC_MeshItemMain>
          <SC_MeshItemActions>
            <Button v-if="canWrite(n)" size="small" type="primary" @click="write(n)">
              {{ t('mesh.contacts.write') }}
            </Button>
            <Button v-if="!n.user?.publicKey" size="small" @click="requestKey(n)">
              {{ t('mesh.mt.nodes.requestKey') }}
            </Button>
            <Button size="small" danger @click="confirmRemove(n)">
              {{ t('mesh.mt.nodes.remove') }}
            </Button>
          </SC_MeshItemActions>
        </SC_MeshItem>
      </SC_MeshList>
      <SC_MeshLinkButton v-if="hiddenCount > 0" type="button" @click="showAll = true">
        {{ t('mesh.mt.nodes.more', { n: filtered.length }) }}
      </SC_MeshLinkButton>
    </template>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Узлы сети Meshtastic, которые знает радио: с кем можно переписываться. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button, Modal } from 'ant-design-vue'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import type { MtNode } from '@/mesh/meshtastic/codec'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useMeshAction, useMeshOpenChat } from './use-mesh-page'
import {
  SC_MeshBadge,
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshCount,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemActions,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshLinkButton,
  SC_MeshList,
  SC_MeshNote,
} from './mesh-page.styled'

/** Сколько узлов показывать до «Показать все». */
const FIRST_PAGE = 30

const { t } = useI18n()
const connection = useMeshtasticConnectionStore()
const { nodes } = storeToRefs(connection)
const act = useMeshAction()
const { writeToNode } = useMeshOpenChat()

const query = ref('')
const showAll = ref(false)

function nameOf(n: MtNode): string {
  return n.user?.longName || n.user?.shortName || `!${n.num.toString(16).padStart(8, '0')}`
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...nodes.value].sort(
    (a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.lastHeard - a.lastHeard
  )
  if (!q) return list
  return list.filter((n) =>
    [nameOf(n), n.user?.shortName ?? '', n.user?.id ?? ''].some((s) => s.toLowerCase().includes(q))
  )
})
const shown = computed(() => (showAll.value ? filtered.value : filtered.value.slice(0, FIRST_PAGE)))
const hiddenCount = computed(() => filtered.value.length - shown.value.length)

/** Писать можно тому, кто принимает сообщения (не «немой» узел инфраструктуры). */
function canWrite(n: MtNode): boolean {
  return !n.user?.isUnmessagable
}

function describe(n: MtNode): string {
  const parts: string[] = []
  if (n.user?.shortName && n.user.longName) parts.push(n.user.shortName)
  if (n.viaMqtt) parts.push(t('mesh.mt.nodes.mqtt'))
  else if (n.hopsAway === 0) parts.push(t('mesh.contacts.direct'))
  else if (n.hopsAway !== null) parts.push(t('mesh.contacts.hops', { n: n.hopsAway }, n.hopsAway))
  if (n.lastHeard > 0) parts.push(t('mesh.contacts.heard', { time: formatTimeAgo(n.lastHeard) }))
  if (n.battery !== null && n.battery <= 100) {
    parts.push(t('mesh.mt.nodes.battery', { level: n.battery }))
  }
  if (n.user?.hwModelName) parts.push(n.user.hwModelName)
  return parts.join(' · ')
}

async function write(n: MtNode): Promise<void> {
  await writeToNode({ num: n.num, name: nameOf(n) })
}

async function requestKey(n: MtNode): Promise<void> {
  await act(() => connection.requestNodeInfo(n.num), t('mesh.mt.nodes.keyRequested'))
}

function confirmRemove(n: MtNode): void {
  Modal.confirm({
    title: t('mesh.mt.nodes.removeConfirm', { name: nameOf(n) }),
    content: t('mesh.mt.nodes.removeHint'),
    okText: t('mesh.mt.nodes.remove'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    onOk: () => act(() => connection.removeNode(n.num)),
  })
}
</script>
