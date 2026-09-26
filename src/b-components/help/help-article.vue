<template>
  <SC_Article>
    <SC_Crumbs v-if="!compact" :aria-label="t('help.title')">
      <a :href="helpHref({ kind: 'home' })" @click="go($event, { kind: 'home' })">{{
        library.title
      }}</a>
      <template v-for="id in crumbs" :key="id">
        <SC_CrumbSep aria-hidden="true">›</SC_CrumbSep>
        <a :href="topicPath(id)" @click="go($event, { kind: 'topic', topic: id, anchor: null })">{{
          titleOf(id)
        }}</a>
      </template>
    </SC_Crumbs>

    <SC_Title>{{ topic.title }}</SC_Title>

    <SC_Platforms v-if="platforms">
      <MonitorIcon />
      {{ platforms }}
    </SC_Platforms>
    <SC_Fallback v-if="topic.fallback">{{ t('help.article.fallback') }}</SC_Fallback>

    <SC_Body>
      <HelpBlocks :blocks="topic.blocks" />
    </SC_Body>

    <SC_Sequence v-if="!compact && (prev || next)">
      <SC_SequenceLink v-if="prev" :href="topicPath(prev)" @click="go($event, target(prev))">
        <SC_SequenceHint>← {{ t('help.article.prev') }}</SC_SequenceHint>
        <SC_SequenceTitle>{{ titleOf(prev) }}</SC_SequenceTitle>
      </SC_SequenceLink>
      <SC_SequenceLink
        v-if="next"
        class="next"
        :href="topicPath(next)"
        @click="go($event, target(next))"
      >
        <SC_SequenceHint>{{ t('help.article.next') }} →</SC_SequenceHint>
        <SC_SequenceTitle>{{ titleOf(next) }}</SC_SequenceTitle>
      </SC_SequenceLink>
    </SC_Sequence>
  </SC_Article>
</template>

<script setup lang="ts">
// Статья справки: хлебные крошки по оглавлению, заголовок, где работает,
// текст и «Предыдущая / Следующая» по порядку оглавления — как листание
// книги в CHM. В боковой панели (compact) — только заголовок и текст.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MonitorIcon } from '@/components/icons'
import type { HelpLibrary, HelpLinkTarget, HelpTopic } from '@/helpers/help/help-types'
import HelpBlocks from './help-blocks.vue'
import { helpHref, topicPath, useHelpView } from './help-view'
import {
  SC_Article,
  SC_Body,
  SC_Crumbs,
  SC_CrumbSep,
  SC_Fallback,
  SC_Platforms,
  SC_Sequence,
  SC_SequenceHint,
  SC_SequenceLink,
  SC_SequenceTitle,
  SC_Title,
} from './styled'

const props = defineProps<{
  topic: HelpTopic
  library: HelpLibrary
  compact?: boolean
}>()

const { t } = useI18n()
const view = useHelpView()

const crumbs = computed(() => props.library.trail.get(props.topic.id) ?? [])
const position = computed(() => props.library.order.indexOf(props.topic.id))
const prev = computed(() => (position.value > 0 ? props.library.order[position.value - 1] : null))
const next = computed(() =>
  position.value >= 0 ? (props.library.order[position.value + 1] ?? null) : null
)

const platforms = computed(() =>
  props.topic.platforms.length
    ? t('help.article.platforms', {
        list: props.topic.platforms.map((p) => t(`help.platform.${p}`)).join(', '),
      })
    : ''
)

function titleOf(id: string): string {
  return props.library.topics.get(id)?.title ?? id
}

function target(id: string): HelpLinkTarget {
  return { kind: 'topic', topic: id, anchor: null }
}

function go(event: MouseEvent, to: HelpLinkTarget): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  view.navigate(to)
}
</script>
