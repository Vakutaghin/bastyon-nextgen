<template>
  <SC_State v-if="failed">
    {{ t('help.loadFailed') }}
    <div>
      <SC_PanelButton type="button" @click="retry">{{ t('help.retry') }}</SC_PanelButton>
    </div>
  </SC_State>
  <SC_State v-else-if="!library">{{ t('help.loading') }}</SC_State>
  <SC_State v-else-if="!topic">{{ t('help.notFound') }}</SC_State>
  <SC_Compact v-else>
    <HelpArticle :topic="topic" :library="library" compact />
  </SC_Compact>
</template>

<script setup lang="ts">
// Статья в боковой панели. Ссылки на другие статьи листают панель (к прошлой
// ведёт «Назад»), ссылки в разделы приложения закрывают её и переходят.
import { computed, nextTick, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useHelpLibrary } from '@/composables/use-help-library'
import { GLOSSARY_TOPIC } from '@/helpers/help/help-library'
import type { HelpLinkTarget } from '@/helpers/help/help-types'
import { useHelpStore } from '@/stores/help-store'
import HelpArticle from './help-article.vue'
import { HELP_VIEW, findHelpSection } from './help-view'
import { SC_Compact, SC_PanelButton, SC_State } from './styled'

const props = defineProps<{ topicId: string }>()

const { t } = useI18n()
const router = useRouter()
const help = useHelpStore()
const { library, failed, retry } = useHelpLibrary()

const topic = computed(() => library.value?.topics.get(props.topicId) ?? null)
/** Раздел, к которому прокрутить после перехода по ссылке внутри панели. */
const pendingAnchor = ref<string | null>(null)

function navigate(target: HelpLinkTarget): void {
  if (target.kind === 'topic') {
    pendingAnchor.value = target.anchor
    help.followInPanel(target.topic)
  } else if (target.kind === 'term') {
    pendingAnchor.value = target.anchor
    help.followInPanel(GLOSSARY_TOPIC)
  } else if (target.kind === 'home' || target.kind === 'app') {
    help.closePanel()
    void router.push(target.kind === 'home' ? '/help' : target.path)
  }
}

provide(HELP_VIEW, { library, highlight: ref<readonly string[]>([]), navigate })

function reveal(anchor: string | null): void {
  void nextTick(() =>
    requestAnimationFrame(() => {
      // Ищем в самой панели: та же статья может быть открыта и на странице под ней.
      const body = document.querySelector('.ant-drawer-body')
      const target = body && anchor ? findHelpSection(body, anchor) : null
      if (target) target.scrollIntoView({ block: 'start' })
      else body?.scrollTo({ top: 0 })
    })
  )
}

watch(
  () => props.topicId,
  () => {
    const anchor = pendingAnchor.value ?? help.panelAnchor
    pendingAnchor.value = null
    reveal(anchor)
  }
)

// Раздел из приложения (`chats#screen`): статья могла ещё грузиться, или
// панель уже показывает эту статью — тогда меняется только раздел.
watch(
  () => [topic.value !== null, help.panelAnchor] as const,
  ([ready, anchor]) => {
    if (ready && anchor) reveal(anchor)
  },
  { immediate: true }
)
</script>
