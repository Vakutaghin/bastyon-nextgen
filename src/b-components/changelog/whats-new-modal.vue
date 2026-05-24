<template>
  <Modal
    :open='visible'
    :title='title'
    :footer='null'
    :width='600'
    :destroy-on-close='true'
    @cancel='close'
    @update:open='onOpenChange'
  >
    <SC_Wrap v-if='latest'>
      <SC_LangSwitcher>
        <SC_LangButton
          v-for='lang in supportedLanguages'
          :key='lang'
          :active='language === lang'
          type='button'
          @click='onSetLanguage(lang)'
        >
          {{ lang.toUpperCase() }}
        </SC_LangButton>
      </SC_LangSwitcher>

      <SC_MarkdownBody>
        <div v-html='latest.html' />
      </SC_MarkdownBody>

      <SC_Footer>
        <SC_DismissButton type='button' @click='close'>
          {{ language === 'ru' ? 'Понятно' : 'Got it' }}
        </SC_DismissButton>
      </SC_Footer>
    </SC_Wrap>
  </Modal>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { Modal } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { useChangelog, useWhatsNewGate } from '@/composables/use-changelog'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { SUPPORTED_LANGUAGES } from '@/helpers/changelog/changelog-loader'
import {
  SC_Wrap,
  SC_Footer,
  SC_DismissButton,
  SC_LangSwitcher,
  SC_LangButton,
  SC_MarkdownBody,
} from './whats-new-modal.styled'

const uiStore = useUIStore()
const { language } = storeToRefs(uiStore)
const { latest } = useChangelog()
const { open: visible, dismiss } = useWhatsNewGate()

const supportedLanguages = SUPPORTED_LANGUAGES

const title = computed(() => {
  if (!latest.value) return ''
  const prefix = language.value === 'ru' ? 'Что нового —' : "What's new —"
  return `${prefix} ${latest.value.displayVersion}`
})

async function close(): Promise<void> {
  await dismiss()
}

function onOpenChange(value: boolean): void {
  if (!value) void close()
}

async function onSetLanguage(lang: AppLanguage): Promise<void> {
  await uiStore.setLanguage(lang)
}
</script>
