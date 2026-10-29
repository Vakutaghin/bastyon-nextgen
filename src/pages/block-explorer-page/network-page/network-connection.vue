<template>
  <SC_NetCardBody>
    <SC_NetCardLead>{{ t('explorerNetwork.connection.lead') }}</SC_NetCardLead>

    <SC_Path :aria-label="t('explorerNetwork.connection.pathAria')">
      <SC_PathStep>
        <b>{{ t('explorerNetwork.connection.device') }}</b>
        <span>{{
          online ? t('explorerNetwork.connection.online') : t('explorerNetwork.connection.offline')
        }}</span>
        <small>{{
          torStore.enabled ? t('explorerNetwork.card.viaTor') : t('explorerNetwork.card.direct')
        }}</small>
      </SC_PathStep>
      <SC_PathStep :class="{ live: !!last }">
        <b>
          {{ t('explorerNetwork.connection.proxy') }}
          <InfoTooltip :text="t('explorerNetwork.tips.proxy')" />
        </b>
        <span>{{ proxyHost ?? t('explorerPage.em') }}</span>
        <small v-if="last">{{ t('explorerNetwork.connection.lastAnswer', { ms: last.ms }) }}</small>
      </SC_PathStep>
      <SC_PathStep :class="{ live: !!last?.node }">
        <b>
          {{ t('explorerNetwork.connection.node') }}
          <InfoTooltip :text="t('explorerNetwork.tips.servingNode')" />
        </b>
        <span>{{ lastNode ?? t('explorerPage.em') }}</span>
        <small v-if="lastNodeCountry">{{ lastNodeCountry }}</small>
      </SC_PathStep>
      <SC_PathStep>
        <b>{{ t('explorerNetwork.connection.network') }}</b>
        <span>{{
          nodesCount
            ? t('explorerNetwork.connection.nodes', { n: formatExplorerNumber(nodesCount) })
            : t('explorerPage.em')
        }}</span>
        <small>{{ t('explorerNetwork.connection.networkHint') }}</small>
      </SC_PathStep>
    </SC_Path>

    <SC_SubTitle>
      {{ t('explorerNetwork.connection.proxiesTitle') }}
      <InfoTooltip :text="t('explorerNetwork.tips.apps')" />
    </SC_SubTitle>
    <SC_ShareList>
      <SC_ProxyRow v-for="proxy in proxies" :key="proxy.host">
        <SC_Dot
          :color="
            proxy.ok
              ? 'var(--ui-success)'
              : proxy.checked
                ? 'var(--ui-error)'
                : 'var(--ui-text-dimmed)'
          "
        />
        <SC_ProxyName>
          {{ proxy.host }}
          <em v-if="proxy.host === proxyHost">{{ t('explorerNetwork.connection.youAreHere') }}</em>
        </SC_ProxyName>
        <SC_ProxyMeta>{{ proxy.meta }}</SC_ProxyMeta>
        <small v-if="proxy.note">{{ proxy.note }}</small>
      </SC_ProxyRow>
    </SC_ShareList>

    <SC_SubTitle>
      {{ t('explorerNetwork.pin.title') }}
      <InfoTooltip :text="t('explorerNetwork.pin.lead')" />
    </SC_SubTitle>
    <SC_PinList role="radiogroup" :aria-label="t('explorerNetwork.pin.title')">
      <SC_PinOption :class="{ active: !preferredNode }">
        <input type="radio" name="explorer-node" :checked="!preferredNode" @change="pick(null)" />
        {{ t('explorerNetwork.pin.auto') }}
      </SC_PinOption>
      <SC_PinOption
        v-for="node in availableNodes"
        :key="`${node.host}:${node.port}`"
        :class="{ active: isPinned(node) }"
      >
        <input type="radio" name="explorer-node" :checked="isPinned(node)" @change="pick(node)" />
        {{ node.host }}
      </SC_PinOption>
    </SC_PinList>
  </SC_NetCardBody>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { appToast } from '@/b-components/app-toast'
import {
  useExplorerPreferredNode,
  type AvailableNode,
} from '@/composables/use-explorer-preferred-node'
import { currentProxy } from '@/helpers/api/node-selector'
import { onRpcTraffic, type RpcTrafficEvent } from '@/helpers/api/rpc-traffic'
import { nodeIp, type NetworkSnapshot } from '@/services/network-map/network-snapshot'
import { useTorStore } from '@/stores/tor-store'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import { formatExplorerNumber } from '../components/shared/format-explorer'
import { useCountryNames } from './use-country-names'
import {
  SC_NetCardBody,
  SC_NetCardLead,
  SC_Path,
  SC_PathStep,
  SC_SubTitle,
  SC_ShareList,
  SC_ProxyRow,
  SC_Dot,
  SC_ProxyName,
  SC_ProxyMeta,
  SC_PinList,
  SC_PinOption,
} from './network-page.styled'

const p = defineProps<{
  snapshot: NetworkSnapshot
  revision: number
  nodesCount: number
  countryOf: (ip: string) => string | null | undefined
}>()

const { t } = useI18n()
const torStore = useTorStore()
const { countryLabel } = useCountryNames()
const { preferredNode, availableNodes, setPreferredNode } = useExplorerPreferredNode()

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const last = ref<RpcTrafficEvent | null>(null)
const proxyHost = ref(currentProxy()?.host ?? null)

const lastNode = computed(() =>
  last.value?.node ? nodeIp(last.value.node, last.value.proxy) : null
)
const lastNodeCountry = computed(() => {
  const ip = lastNode.value
  const code = ip ? p.countryOf(ip) : null
  return code ? countryLabel(code) : ''
})

const proxies = computed(() => {
  void p.revision
  const states = new Map(p.snapshot.proxies.map((x) => [x.host, x]))
  return availableNodes.map(({ host }) => {
    const state = states.get(host)
    if (!state)
      return {
        host,
        ok: false,
        checked: false,
        meta: t('explorerNetwork.connection.notChecked'),
        note: '',
      }
    if (!state.ok)
      return { host, ok: false, checked: true, meta: t('explorerNetwork.card.proxyDown'), note: '' }
    const parts = [
      state.clients !== undefined
        ? t('explorerNetwork.connection.apps', { n: formatExplorerNumber(state.clients) })
        : null,
      state.rps !== undefined ? t('explorerNetwork.card.rpsValue', { n: state.rps }) : null,
      state.latencyMs !== undefined
        ? t('explorerNetwork.card.msValue', { n: state.latencyMs })
        : null,
    ].filter(Boolean)
    const note = state.sameAs
      ? t('explorerNetwork.connection.sameAs', { host: state.sameAs })
      : t('explorerNetwork.card.poolValue', { pool: state.pool.length, known: state.known ?? '—' })
    return { host, ok: true, checked: true, meta: parts.join(' · '), note }
  })
})

function isPinned(node: AvailableNode): boolean {
  const pinned = preferredNode.value
  return !!pinned && pinned.host === node.host && pinned.port === node.port
}

function pick(node: AvailableNode | null): void {
  setPreferredNode(node ? { host: node.host, port: node.port } : null)
  appToast.success({
    message: node
      ? t('explorerNetwork.pin.toastPinned', { host: node.host })
      : t('explorerNetwork.pin.toastAuto'),
  })
}

const syncOnline = () => (online.value = navigator.onLine)
let stop: (() => void) | null = null
onMounted(() => {
  window.addEventListener('online', syncOnline)
  window.addEventListener('offline', syncOnline)
  stop = onRpcTraffic((event) => {
    // Вопросы обхода сети — не «ваш» запрос: их ноду назвали, а не выбрал прокси.
    if (!event.ok || event.pinned) return
    last.value = event
    proxyHost.value = currentProxy()?.host ?? event.proxy
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('online', syncOnline)
  window.removeEventListener('offline', syncOnline)
  stop?.()
})
</script>
