<template>
  <Modal
    :open="visible"
    :title="title"
    :footer="null"
    :width="600"
    :destroy-on-close="true"
    @cancel="close"
    @update:open="onOpenChange"
  >
    <SC_Wrap v-if="shown">
      <SC_LangSwitcher>
        <SC_LangButton
          v-for="lang in supportedLanguages"
          :key="lang"
          :active="language === lang"
          type="button"
          @click="onSetLanguage(lang)"
        >
          {{ lang.toUpperCase() }}
        </SC_LangButton>
      </SC_LangSwitcher>

      <SC_MarkdownBody ref="body" data-testid="whats-new-body">
        <div v-html="shown.html" />
      </SC_MarkdownBody>

      <SC_Footer>
        <!-- Листание по вышедшим версиям: назад — к более ранним. -->
        <SC_VersionNav>
          <SC_NavButton
            type="button"
            :disabled="!older"
            :title="t('changelog.older')"
            :aria-label="t('changelog.older')"
            data-testid="whats-new-older"
            @click="step(1)"
          >
            <LeftOutlined />
            <span v-if="older">{{ older.displayVersion }}</span>
          </SC_NavButton>
          <SC_NavButton
            type="button"
            :disabled="!newer"
            :title="t('changelog.newer')"
            :aria-label="t('changelog.newer')"
            data-testid="whats-new-newer"
            @click="step(-1)"
          >
            <span v-if="newer">{{ newer.displayVersion }}</span>
            <RightOutlined />
          </SC_NavButton>
          <SC_AllVersionsLink type="button" data-testid="whats-new-all" @click="openHistory">
            {{ t('changelog.allVersions') }}
          </SC_AllVersionsLink>
        </SC_VersionNav>

        <SC_DismissButton type="button" @click="close">
          {{ t('changelog.gotIt') }}
        </SC_DismissButton>
      </SC_Footer>
    </SC_Wrap>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { LeftOutlined, RightOutlined } from '@/components/icons'
import { useChangelog, useWhatsNewGate } from '@/composables/use-changelog'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { useHelpStore } from '@/stores/help-store'
import { SUPPORTED_LANGUAGES } from '@/helpers/changelog/changelog-loader'
import {
  SC_Wrap,
  SC_Footer,
  SC_DismissButton,
  SC_LangSwitcher,
  SC_LangButton,
  SC_MarkdownBody,
  SC_VersionNav,
  SC_NavButton,
  SC_AllVersionsLink,
} from './whats-new-modal.styled'

const { t } = useI18n()
const uiStore = useUIStore()
const { language } = storeToRefs(uiStore)
const { entries, latest } = useChangelog()
const { open: visible, dismiss } = useWhatsNewGate()

const supportedLanguages = SUPPORTED_LANGUAGES

// Открывается на версии приложения; листать можно к более ранним и обратно.
const start = computed(() =>
  Math.max(
    0,
    entries.value.findIndex((e) => e.version === latest.value?.version)
  )
)
const offset = ref(0)
const index = computed(() => start.value + offset.value)
const shown = computed(() => entries.value[index.value])
const older = computed(() => entries.value[index.value + 1])
const newer = computed(() => (offset.value > 0 ? entries.value[index.value - 1] : undefined))

const body = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

watch(visible, (open) => {
  if (open) offset.value = 0
})

const title = computed(() => {
  if (!shown.value) return ''
  return `${t('changelog.whatsNewPrefix')} ${shown.value.displayVersion}`
})

async function step(delta: number): Promise<void> {
  const next = offset.value + delta
  if (next < 0 || !entries.value[start.value + next]) return
  offset.value = next
  // Новая версия — с начала текста, а не с места, где читали прежнюю.
  await nextTick()
  const el = body.value instanceof HTMLElement ? body.value : body.value?.$el
  el?.scrollTo?.({ top: 0 })
}

async function close(): Promise<void> {
  await dismiss()
}

function onOpenChange(value: boolean): void {
  if (!value) void close()
}

/** Вся история — книга «История версий» в справке, поверх экрана. */
async function openHistory(): Promise<void> {
  await close()
  useHelpStore().openTopic('releases')
}

async function onSetLanguage(lang: AppLanguage): Promise<void> {
  await uiStore.setLanguage(lang)
}
</script>
