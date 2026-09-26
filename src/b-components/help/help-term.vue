<template>
  <APopover
    v-if="entry"
    :trigger="['hover', 'click']"
    placement="top"
    :overlay-style="TERM_OVERLAY_STYLE"
    :mouse-enter-delay="0.2"
  >
    <template #content>
      <SC_TermCard>
        <SC_TermTitle>{{ entry.term }}</SC_TermTitle>
        <HelpBlocks :blocks="entry.blocks" />
        <SC_TermMore :href="href" @click="more">{{ t('help.term.more') }}</SC_TermMore>
      </SC_TermCard>
    </template>
    <SC_Term type="button"><slot /></SC_Term>
  </APopover>
  <slot v-else />
</template>

<script setup lang="ts">
// Термин из словаря в тексте статьи (ссылка `glossary.md#термин`): по
// наведению или нажатию — определение, как всплывающие подсказки в CHM.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover as APopover } from 'ant-design-vue'
import HelpBlocks from './help-blocks.vue'
import { helpHref, useHelpView } from './help-view'
import { SC_Term, SC_TermCard, SC_TermMore, SC_TermTitle, TERM_OVERLAY_STYLE } from './styled'

const props = defineProps<{ anchor: string }>()

const { t } = useI18n()
const view = useHelpView()

const entry = computed(() => view.library.value?.glossary.get(props.anchor) ?? null)
const href = computed(() => helpHref({ kind: 'term', anchor: props.anchor }))

function more(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  view.navigate({ kind: 'topic', topic: 'glossary', anchor: props.anchor })
}
</script>
