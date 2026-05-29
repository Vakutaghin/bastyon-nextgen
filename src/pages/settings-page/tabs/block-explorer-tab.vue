<template>
  <SC_ExplorerSettingsSection>
    <SC_SettingsSectionTitle>Блок-эксплорер</SC_SettingsSectionTitle>

    <SC_ExplorerSettingsBlock>
      <SC_ExplorerSettingsLead>
        Встроенный блок-эксплорер работает на тех же нодах, что и остальное приложение — без внешних
        редиректов.
      </SC_ExplorerSettingsLead>
      <RouterLink v-slot="{ navigate, href }" custom :to="{ name: 'explorer' }">
        <SC_ExplorerOpenFullButton
          :href="href"
          @click="
            (e) => {
              e.preventDefault()
              navigate()
            }
          "
        >
          Открыть эксплорер →
        </SC_ExplorerOpenFullButton>
      </RouterLink>
    </SC_ExplorerSettingsBlock>

    <SC_ExplorerSettingsBlock>
      <SC_SettingsSectionTitle as="h3" style="font-size: 14px; margin: 0">
        Предпочитаемая нода
      </SC_SettingsSectionTitle>
      <SC_ExplorerSettingsLead>
        По умолчанию эксплорер использует автоматический round-robin по списку публичных нод. Можно
        закрепить конкретную ноду — все запросы эксплорера будут идти к ней. На остальное приложение
        это не влияет.
      </SC_ExplorerSettingsLead>

      <SC_ExplorerNodeList>
        <SC_ExplorerNodeRow :active="!preferredNode">
          <SC_ExplorerNodeRadio
            type="radio"
            name="explorer-node"
            :checked="!preferredNode"
            @change="onPickPreferredNode(null)"
          />
          <SC_ExplorerNodeLabel>Авто (round-robin)</SC_ExplorerNodeLabel>
          <SC_ExplorerNodeHint>По умолчанию</SC_ExplorerNodeHint>
        </SC_ExplorerNodeRow>

        <SC_ExplorerNodeRow
          v-for="node in availableExplorerNodes"
          :key="`${node.host}:${node.port}`"
          :active="isNodePinned(node)"
        >
          <SC_ExplorerNodeRadio
            type="radio"
            name="explorer-node"
            :checked="isNodePinned(node)"
            @change="onPickPreferredNode(node)"
          />
          <SC_ExplorerNodeLabel>{{ node.host }}:{{ node.port }}</SC_ExplorerNodeLabel>
          <SC_ExplorerNodeHint v-if="isNodePinned(node)">Закреплена</SC_ExplorerNodeHint>
        </SC_ExplorerNodeRow>
      </SC_ExplorerNodeList>
    </SC_ExplorerSettingsBlock>
  </SC_ExplorerSettingsSection>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  useExplorerPreferredNode,
  type AvailableNode,
  type PreferredNode,
} from '@/composables/use-explorer-preferred-node'
import { appToast } from '@/b-components/app-toast'
import {
  SC_SettingsSectionTitle,
  SC_ExplorerSettingsSection,
  SC_ExplorerSettingsBlock,
  SC_ExplorerSettingsLead,
  SC_ExplorerOpenFullButton,
  SC_ExplorerNodeList,
  SC_ExplorerNodeRow,
  SC_ExplorerNodeRadio,
  SC_ExplorerNodeLabel,
  SC_ExplorerNodeHint,
} from '../settings-page.styled'

const {
  preferredNode,
  availableNodes: availableExplorerNodes,
  setPreferredNode,
} = useExplorerPreferredNode()

function isNodePinned(node: AvailableNode): boolean {
  const p = preferredNode.value as PreferredNode | null
  return !!p && p.host === node.host && p.port === node.port
}

function onPickPreferredNode(node: AvailableNode | null): void {
  setPreferredNode(node ? { host: node.host, port: node.port } : null)
  appToast.success({
    message: node ? `Закреплена нода ${node.host}` : 'Включён авто-режим',
  })
}
</script>
