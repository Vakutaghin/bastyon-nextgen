<template>
  <template v-for="(block, i) in blocks" :key="i">
    <h2 v-if="block.t === 'heading' && block.level === 2" :id="block.id">
      <HelpInlines :nodes="block.c" />
    </h2>
    <h3 v-else-if="block.t === 'heading' && block.level === 3" :id="block.id">
      <HelpInlines :nodes="block.c" />
    </h3>
    <h4 v-else-if="block.t === 'heading'" :id="block.id"><HelpInlines :nodes="block.c" /></h4>
    <p v-else-if="block.t === 'p'"><HelpInlines :nodes="block.c" /></p>
    <component
      :is="block.ordered ? 'ol' : 'ul'"
      v-else-if="block.t === 'list'"
      :start="block.ordered && block.start !== 1 ? block.start : undefined"
    >
      <li v-for="(item, j) in block.items" :key="j">
        <!-- В «плотном» списке абзацы пунктов — просто строки. -->
        <template v-if="block.tight">
          <template v-for="(child, k) in item" :key="k">
            <HelpInlines v-if="child.t === 'p'" :nodes="child.c" />
            <HelpBlocks v-else :blocks="[child]" />
          </template>
        </template>
        <HelpBlocks v-else :blocks="item" />
      </li>
    </component>
    <SC_Alert v-else-if="block.t === 'alert'" :kind="block.kind" role="note">
      <SC_AlertTitle :kind="block.kind">
        <InfoCircleOutlined v-if="block.kind === 'note'" />
        <BulbOutlined v-else-if="block.kind === 'tip'" />
        <ExclamationCircleOutlined v-else-if="block.kind === 'important'" />
        <WarningOutlined v-else-if="block.kind === 'warning'" />
        <CautionIcon v-else />
        {{ t(`help.alert.${block.kind}`) }}
      </SC_AlertTitle>
      <HelpBlocks :blocks="block.c" />
    </SC_Alert>
    <blockquote v-else-if="block.t === 'quote'"><HelpBlocks :blocks="block.c" /></blockquote>
    <details v-else-if="block.t === 'details'">
      <summary>{{ block.summary }}</summary>
      <HelpBlocks :blocks="block.c" />
    </details>
    <pre v-else-if="block.t === 'code'"><code>{{ block.v }}</code></pre>
    <SC_TableWrap v-else-if="block.t === 'table'">
      <table>
        <thead>
          <tr>
            <th v-for="(cell, j) in block.head" :key="j" :class="alignClass(block.align[j])">
              <HelpInlines :nodes="cell" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, j) in block.rows" :key="j">
            <td v-for="(cell, k) in row" :key="k" :class="alignClass(block.align[k])">
              <HelpInlines :nodes="cell" />
            </td>
          </tr>
        </tbody>
      </table>
    </SC_TableWrap>
    <hr v-else-if="block.t === 'hr'" />
  </template>
</template>

<script setup lang="ts">
// Блоки статьи: заголовки с якорями, абзацы, списки, врезки, сворачиваемые
// подробности, таблицы. Оформление — у контейнера SC_Body (styled.ts).
import { useI18n } from 'vue-i18n'
import {
  BulbOutlined,
  CautionIcon,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@/components/icons'
import type { HelpAlign, HelpBlock } from '@/helpers/help/help-types'
import HelpBlocks from './help-blocks.vue'
import HelpInlines from './help-inlines.vue'
import { SC_Alert, SC_AlertTitle, SC_TableWrap } from './styled'

defineProps<{ blocks: HelpBlock[] }>()

const { t } = useI18n()

function alignClass(align: HelpAlign | undefined): string | undefined {
  return align && align !== 'left' ? `align-${align}` : undefined
}
</script>
