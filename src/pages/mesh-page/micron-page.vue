<template>
  <SC_MicronPage>
    <template v-for="(line, index) in lines" :key="index">
      <SC_MicronLine
        v-if="line.kind === 'text'"
        :align="line.align"
        :depth="line.depth"
        :heading="line.heading"
        :literal="line.literal"
      >
        <template v-for="(part, j) in line.parts" :key="j">
          <SC_MicronLink
            v-if="part.kind === 'link'"
            type="button"
            v-bind="styleOf(part.style)"
            @click="emit('open', part)"
            >{{ part.text }}</SC_MicronLink
          >
          <SC_MicronInput
            v-else-if="part.kind === 'field'"
            :chars="part.width"
            :type="part.masked ? 'password' : 'text'"
            :value="form[part.name] ?? ''"
            :aria-label="part.name"
            autocomplete="off"
            spellcheck="false"
            @input="emit('field', part.name, ($event.target as HTMLInputElement).value)"
          />
          <SC_MicronCheck v-else-if="part.kind === 'check'">
            <input
              :type="part.radio ? 'radio' : 'checkbox'"
              :name="part.radio ? `micron-${part.name}` : undefined"
              :checked="isMicronChecked(form, part)"
              @change="emit('check', part, ($event.target as HTMLInputElement).checked)"
            />
            <SC_MicronSpan v-bind="styleOf(part.style)">{{ part.label }}</SC_MicronSpan>
          </SC_MicronCheck>
          <SC_MicronSpan v-else v-bind="styleOf(part.style)">{{ part.text }}</SC_MicronSpan>
        </template>
      </SC_MicronLine>
      <SC_MicronDivider
        v-else-if="line.kind === 'divider'"
        :depth="line.depth"
        aria-hidden="true"
        >{{ line.char.repeat(200) }}</SC_MicronDivider
      >
      <SC_MicronLine v-else :depth="0" :heading="0" :literal="false" />
    </template>
  </SC_MicronPage>
</template>

<script setup lang="ts">
/**
 * Страница NomadNet из разобранного micron: текст со стилями, ссылки, поля
 * формы. Только данные — ничего из страницы не попадает в разметку как HTML.
 * Значения полей держит родитель: страница сообщает о правках событиями.
 */
import {
  isMicronChecked,
  type MicronForm,
  type MicronLine,
  type MicronPart,
  type MicronStyle,
} from '@/mesh/reticulum/micron'
import {
  SC_MicronCheck,
  SC_MicronDivider,
  SC_MicronInput,
  SC_MicronLine,
  SC_MicronLink,
  SC_MicronPage,
  SC_MicronSpan,
} from './micron-page.styled'

type LinkPart = Extract<MicronPart, { kind: 'link' }>
type CheckPart = Extract<MicronPart, { kind: 'check' }>

defineProps<{ lines: MicronLine[]; form: MicronForm }>()

const emit = defineEmits<{
  open: [part: LinkPart]
  field: [name: string, value: string]
  check: [part: CheckPart, on: boolean]
}>()

function styleOf(s: MicronStyle) {
  return {
    fg: s.fg ?? undefined,
    bg: s.bg ?? undefined,
    bold: s.bold,
    italic: s.italic,
    underline: s.underline,
  }
}
</script>
