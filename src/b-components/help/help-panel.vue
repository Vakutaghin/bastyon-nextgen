<template>
  <ADrawer
    :open="!!help.panelTopic"
    :placement="mobile ? 'bottom' : 'right'"
    :width="PANEL_WIDTH"
    :height="PANEL_HEIGHT"
    :root-style="PANEL_ROOT_STYLE"
    :closable="false"
    :body-style="PANEL_BODY_STYLE"
    :header-style="PANEL_HEADER_STYLE"
    @close="help.closePanel()"
  >
    <template #title>
      <SC_PanelHead>
        <SC_PanelButton v-if="help.panel.length > 1" type="button" @click="help.backInPanel()">
          <LeftOutlined />
          {{ t('help.panel.back') }}
        </SC_PanelButton>
        <SC_PanelSpacer />
        <SC_PanelButton v-if="help.panelTopic" type="button" @click="openFull">
          <HelpBookIcon />
          {{ t('help.panel.open') }}
        </SC_PanelButton>
        <SC_PanelButton
          type="button"
          :aria-label="t('help.panel.close')"
          @click="help.closePanel()"
        >
          <CloseOutlined />
        </SC_PanelButton>
      </SC_PanelHead>
    </template>
    <HelpPanelBody v-if="help.panelTopic" :topic-id="help.panelTopic" />
  </ADrawer>
</template>

<script setup lang="ts">
// Боковая панель контекстной справки — одна на приложение (src.vue),
// открывается через useHelpStore().openTopic(): кнопки «?» и F1. Сама статья
// и всё для её разбора грузятся, только когда панель открыли.
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Drawer as ADrawer } from 'ant-design-vue'
import { CloseOutlined, HelpBookIcon, LeftOutlined } from '@/components/icons'
import { useViewport } from '@/composables/use-viewport'
import { useHelpStore } from '@/stores/help-store'
import { topicPath } from './help-view'
import {
  PANEL_BODY_STYLE,
  PANEL_HEADER_STYLE,
  PANEL_ROOT_STYLE,
  SC_PanelButton,
  SC_PanelHead,
  SC_PanelSpacer,
} from './styled'

const HelpPanelBody = defineAsyncComponent(() => import('./help-panel-body.vue'))

const PANEL_WIDTH = 480
const PANEL_HEIGHT = '85%'

const { t } = useI18n()
const router = useRouter()
const help = useHelpStore()
const { isMobileOrTablet: mobile } = useViewport()

function openFull(): void {
  const id = help.panelTopic
  if (!id) return
  help.closePanel()
  void router.push(topicPath(id))
}
</script>
