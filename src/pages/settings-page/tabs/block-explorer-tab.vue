<template>
  <SC_ExplorerSettingsSection>
    <SC_SettingsSectionTitle>{{ t('settings.explorer.title') }}</SC_SettingsSectionTitle>

    <SC_ExplorerSettingsBlock>
      <SC_ExplorerSettingsLead>
        {{ t('settings.explorer.lead') }}
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
          {{ t('settings.explorer.openFull') }}
        </SC_ExplorerOpenFullButton>
      </RouterLink>
    </SC_ExplorerSettingsBlock>

    <SC_ExplorerSettingsBlock>
      <SC_ExplorerSubsectionTitle as="h3">
        {{ t('settings.explorer.preferredNode') }}
      </SC_ExplorerSubsectionTitle>
      <SC_ExplorerSettingsLead>
        {{ t('settings.explorer.preferredLead') }}
      </SC_ExplorerSettingsLead>

      <SC_ExplorerNodeList>
        <SC_ExplorerNodeRow :active="!preferredNode">
          <SC_ExplorerNodeRadio
            type="radio"
            name="explorer-node"
            :checked="!preferredNode"
            @change="onPickPreferredNode(null)"
          />
          <SC_ExplorerNodeLabel>{{ t('settings.explorer.autoNode') }}</SC_ExplorerNodeLabel>
          <SC_ExplorerNodeHint>{{ t('settings.explorer.default') }}</SC_ExplorerNodeHint>
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
          <SC_ExplorerNodeHint v-if="isNodePinned(node)">{{ t('settings.explorer.pinned') }}</SC_ExplorerNodeHint>
        </SC_ExplorerNodeRow>
      </SC_ExplorerNodeList>
    </SC_ExplorerSettingsBlock>
  </SC_ExplorerSettingsSection>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
  SC_ExplorerSubsectionTitle,
} from '../settings-page.styled'

const { t } = useI18n()
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
    message: node
      ? t('settings.explorer.toastPinned', { host: node.host })
      : t('settings.explorer.toastAuto'),
  })
}
</script>
