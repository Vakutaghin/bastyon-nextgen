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
import { computed, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useHelpLibrary } from '@/composables/use-help-library'
import { GLOSSARY_TOPIC } from '@/helpers/help/help-library'
import type { HelpLinkTarget } from '@/helpers/help/help-types'
import { useHelpStore } from '@/stores/help-store'
import HelpArticle from './help-article.vue'
import { HELP_VIEW } from './help-view'
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

watch(
  () => props.topicId,
  () => {
    const anchor = pendingAnchor.value
    pendingAnchor.value = null
    requestAnimationFrame(() => {
      // Ищем в самой панели: та же статья может быть открыта и на странице под ней.
      const body = document.querySelector('.ant-drawer-body')
      const ids = body ? [...body.querySelectorAll<HTMLElement>('[id]')] : []
      const target = anchor ? ids.find((el) => el.id === anchor) : null
      if (target) target.scrollIntoView({ block: 'start' })
      else body?.scrollTo({ top: 0 })
    })
  }
)
</script>
