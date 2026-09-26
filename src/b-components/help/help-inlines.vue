<template>
  <template v-for="(node, i) in nodes" :key="i">
    <template v-if="node.t === 'text'">
      <template v-for="(part, j) in marked(node.v)" :key="j">
        <mark v-if="part.mark">{{ part.text }}</mark>
        <template v-else>{{ part.text }}</template>
      </template>
    </template>
    <strong v-else-if="node.t === 'strong'"><HelpInlines :nodes="node.c" /></strong>
    <em v-else-if="node.t === 'em'"><HelpInlines :nodes="node.c" /></em>
    <s v-else-if="node.t === 's'"><HelpInlines :nodes="node.c" /></s>
    <code v-else-if="node.t === 'code'">{{ node.v }}</code>
    <br v-else-if="node.t === 'br'" />
    <HelpTerm v-else-if="node.t === 'link' && node.to.kind === 'term'" :anchor="node.to.anchor">
      <HelpInlines :nodes="node.c" />
    </HelpTerm>
    <a
      v-else-if="node.t === 'link' && node.to.kind === 'external'"
      :href="node.to.href"
      target="_blank"
      rel="noopener noreferrer"
      ><HelpInlines :nodes="node.c"
    /></a>
    <a
      v-else-if="node.t === 'link' && node.to.kind !== 'broken'"
      :href="helpHref(node.to)"
      @click="follow($event, node.to)"
      ><HelpInlines :nodes="node.c"
    /></a>
    <span v-else-if="node.t === 'link'"><HelpInlines :nodes="node.c" /></span>
    <img
      v-else-if="node.t === 'image' && node.src && shown(node.theme)"
      :src="node.src"
      :alt="node.alt"
      loading="lazy"
    />
  </template>
</template>

<script setup lang="ts">
// Текст статьи: выделение, код, ссылки, картинки. Слова из поиска
// подсвечиваются. Ссылки внутри справки переходят через view.navigate —
// страница меняет адрес, боковая панель листает сама себя; с Ctrl/Cmd браузер
// откроет адрес в новой вкладке, как обычная ссылка.
import { useTheme } from '@/composables/use-theme'
import { markWords } from '@/helpers/help/help-stem'
import type { HelpInline, HelpLinkTarget } from '@/helpers/help/help-types'
import HelpInlines from './help-inlines.vue'
import HelpTerm from './help-term.vue'
import { helpHref, useHelpView } from './help-view'

defineProps<{ nodes: HelpInline[] }>()

const view = useHelpView()
const { isDark } = useTheme()

function marked(text: string) {
  return markWords(text, view.highlight.value)
}

function shown(theme: 'light' | 'dark' | null): boolean {
  return theme === null || (theme === 'dark') === isDark.value
}

function follow(event: MouseEvent, target: HelpLinkTarget): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  view.navigate(target)
}
</script>
