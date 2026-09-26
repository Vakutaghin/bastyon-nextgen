<template>
  <SC_HomeTitle>{{ library.title }}</SC_HomeTitle>
  <SC_Body>
    <HelpBlocks :blocks="library.intro" />
  </SC_Body>
  <SC_Books v-if="!compact">
    <SC_Book v-for="book in library.toc" :key="book.id">
      <SC_BookTitle :href="topicPath(book.id)" @click="open($event, book.id)">
        <HelpBookIcon v-if="book.children.length" />
        <FileTextOutlined v-else />
        {{ book.label }}
      </SC_BookTitle>
      <ul v-if="book.children.length">
        <li v-for="child in book.children" :key="child.id">
          <a :href="topicPath(child.id)" @click="open($event, child.id)">{{ child.label }}</a>
        </li>
      </ul>
      <!-- У статьи без подразделов — её вводный абзац: о чём она. -->
      <SC_BookLead v-else-if="leadOf(book.id)">{{ leadOf(book.id) }}</SC_BookLead>
    </SC_Book>
  </SC_Books>
</template>

<script setup lang="ts">
// Главная справки (README.md): вступление и разделы карточками. На телефоне
// разделы показывает навигатор под вступлением (compact).
import { FileTextOutlined, HelpBookIcon } from '@/components/icons'
import HelpBlocks from '@/b-components/help/help-blocks.vue'
import { topicPath } from '@/b-components/help/help-view'
import { SC_Body } from '@/b-components/help/styled'
import { plainText } from '@/helpers/help/help-markdown'
import type { HelpLibrary } from '@/helpers/help/help-types'
import { useHelpPageContext } from '../use-help-page'
import { SC_Book, SC_BookLead, SC_Books, SC_BookTitle, SC_HomeTitle } from '../help-page.styled'

const props = defineProps<{ library: HelpLibrary; compact?: boolean }>()

const page = useHelpPageContext()

function leadOf(id: string): string {
  const first = props.library.topics.get(id)?.blocks[0]
  return first?.t === 'p' ? plainText(first.c) : ''
}

function open(event: MouseEvent, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  page.openTopic(id)
}
</script>
