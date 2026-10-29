<template>
  <div>
    <SC_TableTools>
      <SC_TableSearch
        v-model="query"
        type="search"
        :placeholder="t('explorerNetwork.table.search')"
        :aria-label="t('explorerNetwork.table.search')"
      />
      <SC_Chip
        type="button"
        :class="{ active: onlyOpen }"
        :aria-pressed="onlyOpen"
        @click="onlyOpen = !onlyOpen"
      >
        {{ t('explorerNetwork.table.onlyOpen') }}
      </SC_Chip>
      <SC_Chip
        type="button"
        :class="{ active: onlyPool }"
        :aria-pressed="onlyPool"
        @click="onlyPool = !onlyPool"
      >
        {{ t('explorerNetwork.table.onlyPool') }}
      </SC_Chip>
      <SC_Chip v-if="country" type="button" class="active" @click="emit('clear-country')">
        {{ countryLabel(country) }} ×
      </SC_Chip>
    </SC_TableTools>

    <SC_TableScroll>
      <SC_Table>
        <thead>
          <tr>
            <th
              v-for="col in COLUMNS"
              :key="col.key"
              :class="[col.class, { sorted: sortKey === col.key }]"
              :aria-sort="ariaSort(col.key)"
            >
              <button type="button" @click="sortBy(col.key)">
                {{ t(`explorerNetwork.table.col.${col.key}`) }}
                <template v-if="sortKey === col.key">{{ sortDesc ? '↓' : '↑' }}</template>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in visible"
            :key="row.ip"
            class="clickable"
            :class="{ active: row.ip === selected }"
            tabindex="0"
            @click="emit('pick', row.ip)"
            @keydown.enter.prevent="emit('pick', row.ip)"
          >
            <td class="mono">{{ row.ip }}</td>
            <td>{{ row.country ? countryLabel(row.country) : t('explorerPage.em') }}</td>
            <td>{{ row.version ?? t('explorerPage.em') }}</td>
            <td class="hide-mobile">{{ t(`explorerNetwork.kind.${row.kind}`) }}</td>
            <td>
              <SC_Tag :color="syncColor(row)">{{ syncText(row) }}</SC_Tag>
            </td>
            <td class="hide-mobile">
              {{
                row.listening
                  ? t('explorerNetwork.access.openShort')
                  : t('explorerNetwork.access.natShort')
              }}
            </td>
            <td class="num">{{ formatExplorerNumber(row.degree) }}</td>
            <td class="num hide-mobile">
              {{ row.proxies.length ? formatExplorerNumber(row.users) : t('explorerPage.em') }}
            </td>
            <td class="muted hide-mobile">
              {{ row.onlineSince ? formatTimeAgo(row.onlineSince) : t('explorerPage.em') }}
            </td>
          </tr>
        </tbody>
      </SC_Table>
    </SC_TableScroll>

    <SC_TableFooter>
      <span>{{
        t('explorerNetwork.table.shown', { shown: visible.length, total: filtered.length })
      }}</span>
      <SC_NetButton
        v-if="visible.length < filtered.length"
        type="button"
        class="secondary"
        @click="limit += PAGE"
      >
        {{ t('explorerNetwork.table.more') }}
      </SC_NetButton>
    </SC_TableFooter>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import { compareVersions, type NodeRow } from '@/services/network-map/network-stats'
import { formatExplorerNumber } from '../components/shared/format-explorer'
import { useCountryNames } from './use-country-names'
import {
  SC_TableTools,
  SC_TableSearch,
  SC_Chip,
  SC_TableScroll,
  SC_Table,
  SC_Tag,
  SC_TableFooter,
  SC_NetButton,
} from './network-page.styled'

const p = defineProps<{
  rows: NodeRow[]
  country: string | null
  selected: string | null
}>()

const emit = defineEmits<{ pick: [ip: string]; 'clear-country': [] }>()

const { t } = useI18n()
const { countryName, countryLabel } = useCountryNames()

type SortKey =
  | 'ip'
  | 'country'
  | 'version'
  | 'kind'
  | 'sync'
  | 'access'
  | 'degree'
  | 'users'
  | 'online'
const COLUMNS: { key: SortKey; class?: string }[] = [
  { key: 'ip' },
  { key: 'country' },
  { key: 'version' },
  { key: 'kind', class: 'hide-mobile' },
  { key: 'sync' },
  { key: 'access', class: 'hide-mobile' },
  { key: 'degree', class: 'num' },
  { key: 'users', class: 'num hide-mobile' },
  { key: 'online', class: 'hide-mobile' },
]

const PAGE = 50
const query = ref('')
const onlyOpen = ref(false)
const onlyPool = ref(false)
const sortKey = ref<SortKey>('degree')
const sortDesc = ref(true)
const limit = ref(PAGE)

watch([query, onlyOpen, onlyPool, () => p.country], () => (limit.value = PAGE))

function syncText(row: NodeRow): string {
  if (row.forked) return t('explorerNetwork.sync.forked')
  if (row.sync === 'behind')
    return t('explorerNetwork.card.behindBy', { n: formatExplorerNumber(row.lag ?? 0) })
  return t(`explorerNetwork.sync.${row.sync}`)
}

function syncColor(row: NodeRow): string {
  if (row.forked) return 'var(--ui-error)'
  if (row.sync === 'synced') return 'var(--ui-success)'
  if (row.sync === 'behind') return 'var(--ui-warning)'
  return 'var(--ui-text-dimmed)'
}

const SYNC_ORDER = { synced: 0, behind: 1, unknown: 2 } as const

function compare(a: NodeRow, b: NodeRow): number {
  switch (sortKey.value) {
    case 'ip':
      return a.ip.localeCompare(b.ip, undefined, { numeric: true })
    case 'country':
      return countryName(a.country ?? 'ZZ').localeCompare(countryName(b.country ?? 'ZZ'))
    case 'version':
      return compareVersions(a.version ?? '0', b.version ?? '0')
    case 'kind':
      return a.kind.localeCompare(b.kind)
    case 'sync':
      return (
        (a.forked ? 3 : SYNC_ORDER[a.sync]) - (b.forked ? 3 : SYNC_ORDER[b.sync]) ||
        (a.lag ?? 0) - (b.lag ?? 0)
      )
    case 'access':
      return Number(a.listening) - Number(b.listening)
    case 'users':
      return a.users - b.users
    case 'online':
      // Раньше в сети — «больше»: сортировка по убыванию ставит долгожителей сверху.
      return (b.onlineSince ?? Infinity) - (a.onlineSince ?? Infinity)
    default:
      return a.degree - b.degree
  }
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = p.rows.filter((row) => {
    if (onlyOpen.value && !row.listening) return false
    if (onlyPool.value && !row.proxies.length) return false
    if (p.country && row.country !== p.country) return false
    if (!q) return true
    return (
      row.ip.includes(q) ||
      (row.version ?? '').includes(q) ||
      (row.country ? countryName(row.country).toLowerCase().includes(q) : false)
    )
  })
  const sign = sortDesc.value ? -1 : 1
  return list.sort((a, b) => sign * compare(a, b))
})

const visible = computed(() => filtered.value.slice(0, limit.value))

function sortBy(key: SortKey): void {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    sortDesc.value = key === 'degree' || key === 'users' || key === 'online' || key === 'version'
  }
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDesc.value ? 'descending' : 'ascending'
}

/** Выбрали ноду на схеме — таблица показывает её, даже если она за пределами страницы. */
watch(
  () => p.selected,
  (ip) => {
    if (!ip) return
    const at = filtered.value.findIndex((row) => row.ip === ip)
    if (at >= limit.value) limit.value = Math.ceil((at + 1) / PAGE) * PAGE
  }
)
</script>
