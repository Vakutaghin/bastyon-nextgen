<template>
  <SC_NetCountries>
    <NetworkWorldMap
      :countries="countries.known"
      :selected="selected"
      @select="emit('select', $event)"
    />
    <div>
      <SC_ShareList>
        <SC_ShareRow
          v-for="c in shown"
          :key="c.key"
          class="clickable"
          :class="{ active: selected === c.key }"
          role="button"
          tabindex="0"
          :aria-pressed="selected === c.key"
          @click="toggle(c.key)"
          @keydown.enter.prevent="toggle(c.key)"
          @keydown.space.prevent="toggle(c.key)"
        >
          <SC_ShareName>{{ countryLabel(c.key) }}</SC_ShareName>
          <SC_ShareCount
            >{{ formatExplorerNumber(c.count) }} · {{ percent(c.share) }}</SC_ShareCount
          >
          <SC_ShareBar :share="c.share / maxShare" />
        </SC_ShareRow>
        <SC_ShareRow v-if="countries.unknown && (expanded || countries.known.length <= LIMIT)">
          <SC_ShareName>{{ t('explorerNetwork.countryUnknown') }}</SC_ShareName>
          <SC_ShareCount>{{ formatExplorerNumber(countries.unknown) }}</SC_ShareCount>
        </SC_ShareRow>
      </SC_ShareList>
      <SC_ShareMore
        v-if="countries.known.length > LIMIT"
        type="button"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? t('explorerNetwork.showLess')
            : t('explorerNetwork.showAllCountries', { n: countries.known.length })
        }}
      </SC_ShareMore>
    </div>
  </SC_NetCountries>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CountShare } from '@/services/network-map/network-stats'
import { formatExplorerNumber } from '../components/shared/format-explorer'
import NetworkWorldMap from './network-world-map/network-world-map.vue'
import { useCountryNames } from './use-country-names'
import {
  SC_NetCountries,
  SC_ShareList,
  SC_ShareRow,
  SC_ShareName,
  SC_ShareCount,
  SC_ShareBar,
  SC_ShareMore,
} from './network-page.styled'

const p = defineProps<{
  countries: { known: CountShare<string>[]; unknown: number }
  selected: string | null
  percent: (share: number) => string
}>()

const emit = defineEmits<{ select: [code: string | null] }>()

const { t } = useI18n()
const { countryLabel } = useCountryNames()

const LIMIT = 10
const expanded = ref(false)
const shown = computed(() =>
  expanded.value ? p.countries.known : p.countries.known.slice(0, LIMIT)
)
const maxShare = computed(() => p.countries.known[0]?.share || 1)

function toggle(code: string): void {
  emit('select', p.selected === code ? null : code)
}
</script>
