<template>
  <Dropdown
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :overlay-style="{ zIndex: 3000 }"
  >
    <SC_TorWrapper :variant="variant" @click="onTriggerClick">
      <CheckCircleFilled v-if="variant === 'ready'" :style="ICON_SIZE_XL" />
      <LoadingOutlined v-else-if="variant === 'busy'" :style="ICON_SIZE_XL" spin />
      <WarningFilled v-else-if="variant === 'failed'" :style="ICON_SIZE_XL" />
      <SafetyOutlined v-else :style="ICON_SIZE_XL" />
    </SC_TorWrapper>

    <template #overlay>
      <SC_TorMenu @click.stop @mousedown.stop>
        <SC_TorRow>
          <SC_TorTitle>Tor</SC_TorTitle>
          <Switch :checked="enabled" :disabled="!available" @click="onToggleSwitch" />
        </SC_TorRow>

        <SC_TorStatusLine>{{ statusLine }}</SC_TorStatusLine>
        <SC_TorInlineActions v-if="enabled && status === 'failed'">
          <Button size="small" @click="onRetry">{{ t('header.torRetry') }}</Button>
        </SC_TorInlineActions>
        <SC_TorHint v-if="countryLine">{{ countryLine }}</SC_TorHint>
        <SC_TorWarning v-if="stalled && status === 'bootstrapping'">
          {{ t('header.torStalledHint') }}
        </SC_TorWarning>
        <!-- Честно о границах: через Tor идёт только appFetch, медиа/фреймы — нет (V21). -->
        <SC_TorHint v-if="enabled">{{ t('header.torMediaHint') }}</SC_TorHint>

        <SC_TorProgressOuter v-if="showProgress">
          <SC_TorProgressInner :pct="progressPct" />
        </SC_TorProgressOuter>

        <SC_TorBridgeBlock>
          <SC_TorBridgeTitle>{{ t('header.torBridges') }}</SC_TorBridgeTitle>
          <RadioGroup
            :value="localKind"
            @change="(e: RadioChangeEvent) => onSelectKind(e.target.value as TorBridgeKind)"
          >
            <SC_TorRadioColumn>
              <Radio value="auto">{{ t('header.torBridgesAuto') }}</Radio>
              <Radio value="none">{{ t('header.torBridgesNone') }}</Radio>
              <Radio value="snowflake">Snowflake</Radio>
              <Radio value="obfs4">{{ t('header.torBridgesObfs4') }}</Radio>
              <Radio value="meek">{{ t('header.torBridgesMeek') }}</Radio>
              <Radio value="custom">{{ t('header.torBridgesCustom') }}</Radio>
            </SC_TorRadioColumn>
          </RadioGroup>
          <SC_TorHint v-if="localKind === 'auto'">{{ t('header.torBridgesAutoHint') }}</SC_TorHint>
          <template v-if="localKind === 'custom'">
            <SC_TorTextarea
              :value="localCustom"
              :placeholder="CUSTOM_PLACEHOLDER"
              @input="onCustomTextareaInput"
            />
            <SC_TorHint>{{ t('header.torBridgesCustomHint') }}</SC_TorHint>
            <SC_TorInlineActions>
              <Button
                size="small"
                :loading="requesting"
                :disabled="!available"
                @click="onRequestBridges"
              >
                {{ t('header.torRequestBridges') }}
              </Button>
            </SC_TorInlineActions>
            <SC_TorHint v-if="requestNote">{{ requestNote }}</SC_TorHint>
            <SC_TorWarning v-if="rejectedBridges.length && !dirty">
              {{ t('header.torBridgesRejected', { n: rejectedBridges.length }) }}
            </SC_TorWarning>
          </template>
          <SC_TorActions>
            <Button size="small" type="primary" :disabled="!dirty" @click="onApplyBridges">
              {{ t('header.apply') }}
            </Button>
          </SC_TorActions>
          <SC_TorHint> {{ t('header.torBridgesRestartHint') }} </SC_TorHint>
        </SC_TorBridgeBlock>

        <SC_TorHint v-if="!available"> {{ t('header.torDesktopOnly') }} </SC_TorHint>
      </SC_TorMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Dropdown, Switch, Radio, Button, Modal } from 'ant-design-vue'
import type { RadioChangeEvent } from 'ant-design-vue'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import {
  SafetyOutlined,
  LoadingOutlined,
  WarningFilled,
  CheckCircleFilled,
} from '@/components/icons'
import { useTorStore, type TorBridgeKind } from '@/stores/tor-store'
import { countryDisplayName, torTransportLabel } from '@/helpers/tor/tor-transport-label'
import {
  SC_TorWrapper,
  SC_TorMenu,
  SC_TorRow,
  SC_TorTitle,
  SC_TorBridgeTitle,
  SC_TorStatusLine,
  SC_TorProgressOuter,
  SC_TorProgressInner,
  SC_TorBridgeBlock,
  SC_TorTextarea,
  SC_TorActions,
  SC_TorHint,
  SC_TorRadioColumn,
  SC_TorInlineActions,
  SC_TorWarning,
} from './styled'

const RadioGroup = Radio.Group

const TOR_CONSENT_KEY = 'tor:seen-consent:v2'

/** Образцы строк — как их выдают @GetBridgesBot и bridges.torproject.org. */
const CUSTOM_PLACEHOLDER = [
  'webtunnel [2001:db8::1]:443 FINGERPRINT url=https://… ver=0.0.3',
  'obfs4 203.0.113.5:443 FINGERPRINT cert=… iat-mode=0',
].join('\n')

const { t, locale } = useI18n()

const tor = useTorStore()
const {
  available,
  enabled,
  status,
  bootstrapPct,
  message,
  install,
  useBridges,
  bridgeKind,
  customBridges,
  activeTransport,
  attempt,
  country,
  stalled,
  fetchingBridges,
  errorCode,
  rejectedBridges,
} = storeToRefs(tor)

const visible = ref(false)
const localUseBridges = ref(useBridges.value)
const localKind = ref<TorBridgeKind>(bridgeKind.value)
const localCustom = ref(customBridges.value)
const dirty = ref(false)
const requesting = ref(false)
const requestNote = ref<string | null>(null)

onMounted(() => {
  tor.hydrate().catch(() => {})
})

watch(useBridges, (v) => {
  if (!dirty.value) localUseBridges.value = v
})
watch(bridgeKind, (v) => {
  if (!dirty.value) localKind.value = v
})
watch(customBridges, (v) => {
  if (!dirty.value) localCustom.value = v
})

const variant = computed<'off' | 'busy' | 'ready' | 'failed'>(() => {
  if (status.value === 'ready') return 'ready'
  if (status.value === 'failed') return 'failed'
  if (
    status.value === 'starting' ||
    status.value === 'bootstrapping' ||
    status.value === 'installing'
  ) {
    return 'busy'
  }
  return 'off'
})

/** Чем идёт подключение, для строки статуса; `null` — без мостов. */
const via = computed<string | null>(() => {
  const label = torTransportLabel(activeTransport.value)
  if (!label) return null
  if (label.kind === 'brand') return label.name
  return label.kind === 'custom' ? t('header.torViaCustom') : t('header.torViaVanilla')
})

const countryLine = computed<string | null>(() => {
  if (!country.value || bridgeKind.value !== 'auto') return null
  if (status.value === 'off' || status.value === 'installing') return null
  return t('header.torCountry', { country: countryDisplayName(country.value, locale.value) })
})

const failedLine = computed<string>(() => {
  if (errorCode.value === 'all_methods_failed') return t('header.torErrorAllFailed')
  if (errorCode.value === 'no_valid_bridges') return t('header.torErrorNoBridges')
  return message.value
    ? t('header.torStatusError', { message: message.value })
    : t('header.torError')
})

const bootstrappingLine = computed<string>(() => {
  const pct = bootstrapPct.value
  const base = via.value
    ? t('header.torStatusBootstrappingVia', { via: via.value, pct })
    : t('header.torStatusBootstrapping', { pct })
  if (bridgeKind.value !== 'auto' || attempt.value < 2) return base
  return `${base} · ${t('header.torStatusAttempt', { n: attempt.value })}`
})

const statusLine = computed<string>(() => {
  switch (status.value) {
    case 'off':
      return enabled.value ? t('header.torStatusStopping') : t('header.torStatusOff')
    case 'installing':
      return install.value
        ? t('header.torStatusInstalling', {
            pct: Math.round(install.value.fraction * 100),
            message: install.value.message,
          })
        : t('header.torStatusInstallingShort')
    case 'starting':
      return fetchingBridges.value
        ? t('header.torStatusFetchingBridges')
        : t('header.torStatusStarting')
    case 'bootstrapping':
      return bootstrappingLine.value
    case 'ready':
      return via.value
        ? t('header.torStatusReadyVia', { via: via.value })
        : t('header.torStatusReady')
    case 'failed':
      return failedLine.value
    default:
      return ''
  }
})

const progressPct = computed<number>(() => {
  if (status.value === 'installing' && install.value) {
    return install.value.fraction * 100
  }
  if (status.value === 'bootstrapping') return bootstrapPct.value
  if (status.value === 'ready') return 100
  return 0
})

const showProgress = computed<boolean>(
  () =>
    status.value === 'installing' || status.value === 'bootstrapping' || status.value === 'starting'
)

async function onTriggerClick(): Promise<void> {
  if (!available.value) {
    Modal.info({
      title: t('header.torDesktopOnlyTitle'),
      content: t('header.torDesktopOnlyContent'),
    })
    return
  }
  visible.value = !visible.value
}

async function onToggleSwitch(...args: unknown[]): Promise<void> {
  // ASwitch passes (checked, event); other elements may pass an Event.
  // Stop propagation defensively when an Event is supplied — parent SC_TorMenu
  // also has @click.stop so this is belt-and-braces.
  for (const a of args) {
    if (a && typeof (a as { stopPropagation?: unknown }).stopPropagation === 'function') {
      ;(a as Event).stopPropagation()
      break
    }
  }
  if (!enabled.value) {
    // Согласие при первом включении. Ключ с версией: текст стал честнее (V21 —
    // медиа мимо Tor), и старое «да» на старый текст не считается.
    const seen = localStorage.getItem(TOR_CONSENT_KEY) === '1'
    if (!seen) {
      const ok = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: t('header.torEnableTitle'),
          content: t('header.torEnableContent'),
          okText: t('header.torEnableOk'),
          cancelText: t('header.cancel'),
          onOk: () => {
            localStorage.setItem(TOR_CONSENT_KEY, '1')
            resolve(true)
          },
          onCancel: () => resolve(false),
        })
      })
      if (!ok) return
    }
    await tor.enable()
  } else {
    await tor.disable()
  }
}

function onSelectKind(kind: TorBridgeKind): void {
  localKind.value = kind
  localUseBridges.value = kind !== 'none'
  dirty.value = true
}

function onCustomTextareaInput(e: Event): void {
  const value = (e.target as HTMLTextAreaElement | null)?.value ?? ''
  localCustom.value = value
  dirty.value = true
}

/** Свежие мосты от Tor Project заменяют список: старые, скорее всего, и не работали. */
async function onRequestBridges(): Promise<void> {
  requesting.value = true
  requestNote.value = null
  try {
    const result = await tor.requestBridges()
    if (result.bridges.length) {
      localCustom.value = result.bridges.join('\n')
      dirty.value = true
    }
    requestNote.value = t('header.torRequestBridgesDone', { n: result.bridges.length })
  } catch (e) {
    requestNote.value = t('header.torRequestBridgesFailed', { message: String(e) })
  } finally {
    requesting.value = false
  }
}

/** После неудачи — тот же выбор заново: Moat мог выдать новые мосты. */
async function onRetry(): Promise<void> {
  await tor.applyAndRestart({
    useBridges: useBridges.value,
    kind: bridgeKind.value,
    customBridges: customBridges.value,
  })
}

async function onApplyBridges(): Promise<void> {
  dirty.value = false
  requestNote.value = null
  await tor.applyAndRestart({
    useBridges: localUseBridges.value,
    kind: localKind.value,
    customBridges: localCustom.value,
  })
}
</script>
