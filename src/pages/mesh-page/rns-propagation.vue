<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>{{ t('mesh.rns.propagation.title') }}</SC_MeshCardTitle>
      <Button
        v-if="config.propagationNode"
        :loading="syncing"
        :disabled="status !== 'running'"
        @click="sync"
      >
        {{ t('mesh.rns.propagation.sync') }}
      </Button>
    </SC_MeshCardHead>

    <SC_MeshNote>{{ t('mesh.rns.propagation.lead') }}</SC_MeshNote>
    <SC_MeshNote v-if="syncText">{{ syncText }}</SC_MeshNote>

    <SC_MeshNote v-if="propagationNodes.length === 0 && !config.propagationNode">
      {{ t('mesh.rns.propagation.empty') }}
    </SC_MeshNote>
    <SC_MeshList v-else>
      <SC_MeshItem v-if="config.propagationNode && !heard(config.propagationNode)">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ config.propagationNode.slice(0, 12) }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ t('mesh.rns.propagation.chosen') }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <Button size="small" @click="choose(null)">{{ t('mesh.channels.remove') }}</Button>
      </SC_MeshItem>
      <SC_MeshItem v-for="p in propagationNodes" :key="p.dest">
        <SC_MeshItemMain>
          <SC_MeshItemName>
            {{ p.name || p.dest.slice(0, 12) }}
            <SC_MeshBadge v-if="p.dest === config.propagationNode">
              {{ t('mesh.rns.propagation.chosen') }}
            </SC_MeshBadge>
          </SC_MeshItemName>
          <SC_MeshItemMeta>{{ p.dest.slice(0, 12) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <Button v-if="p.dest !== config.propagationNode" size="small" @click="choose(p.dest)">
          {{ t('mesh.rns.propagation.use') }}
        </Button>
        <Button v-else size="small" @click="choose(null)">{{ t('mesh.channels.remove') }}</Button>
      </SC_MeshItem>
    </SC_MeshList>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/**
 * Узел доставки (propagation node): хранит сообщения, пока собеседник не в
 * сети, до 30 дней. Выбранный узел получает наши письма офлайн-собеседникам,
 * а «Получить сообщения» забирает с него адресованное нам.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { useMeshAction } from './use-mesh-page'
import {
  SC_MeshBadge,
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshItem,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
} from './mesh-page.styled'

const { t } = useI18n()
const rns = useReticulumStore()
const { config, propagationNodes, syncState, status } = storeToRefs(rns)
const act = useMeshAction()

const syncing = computed(
  () => syncState.value?.state === 'requesting' || syncState.value?.state === 'receiving'
)

const syncText = computed(() => {
  const s = syncState.value
  if (!s) return ''
  if (s.state === 'done') return t('mesh.rns.propagation.done', { n: s.received }, s.received)
  if (s.state === 'failed') return t('mesh.rns.propagation.failed')
  return t('mesh.rns.propagation.syncing')
})

function heard(dest: string): boolean {
  return propagationNodes.value.some((p) => p.dest === dest)
}

async function choose(dest: string | null): Promise<void> {
  await act(() => rns.updateConfig({ propagationNode: dest }))
}

async function sync(): Promise<void> {
  await act(() => rns.sync())
}
</script>
