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

        <SC_TorProgressOuter v-if="showProgress">
          <SC_TorProgressInner :pct="progressPct" />
        </SC_TorProgressOuter>

        <SC_TorBridgeBlock>
          <SC_TorTitle style="font-size: 12px">{{ t('header.torBridges') }}</SC_TorTitle>
          <RadioGroup
            :value="localKind"
            @change="(e: RadioChangeEvent) => onSelectKind(e.target.value as TorBridgeKind)"
          >
            <Radio value="none">{{ t('header.torBridgesNone') }}</Radio>
            <Radio value="snowflake">Snowflake</Radio>
            <Radio value="obfs4">{{ t('header.torBridgesObfs4') }}</Radio>
            <Radio value="custom">{{ t('header.torBridgesCustom') }}</Radio>
          </RadioGroup>
          <SC_TorTextarea
            v-if="localKind === 'custom'"
            :value="localCustom"
            placeholder="obfs4 IP:PORT FINGERPRINT cert=... iat-mode=..."
            @input="onCustomTextareaInput"
          />
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
} from '@ant-design/icons-vue'
import { useTorStore, type TorBridgeKind } from '@/stores/tor-store'
import {
  SC_TorWrapper,
  SC_TorMenu,
  SC_TorRow,
  SC_TorTitle,
  SC_TorStatusLine,
  SC_TorProgressOuter,
  SC_TorProgressInner,
  SC_TorBridgeBlock,
  SC_TorTextarea,
  SC_TorActions,
  SC_TorHint,
} from './styled'

const RadioGroup = Radio.Group

const { t } = useI18n()

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
} = storeToRefs(tor)

const visible = ref(false)
const localUseBridges = ref(useBridges.value)
const localKind = ref<TorBridgeKind>(bridgeKind.value)
const localCustom = ref(customBridges.value)
const dirty = ref(false)

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
      return t('header.torStatusStarting')
    case 'bootstrapping':
      return t('header.torStatusBootstrapping', { pct: bootstrapPct.value })
    case 'ready':
      return t('header.torStatusReady')
    case 'failed':
      return message.value ? t('header.torStatusError', { message: message.value }) : t('header.torError')
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
    // First-run consent if Tor is not yet installed.
    const seen = localStorage.getItem('tor:seen-consent') === '1'
    if (!seen) {
      const ok = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: t('header.torEnableTitle'),
          content: t('header.torEnableContent'),
          okText: t('header.torEnableOk'),
          cancelText: t('header.cancel'),
          onOk: () => {
            localStorage.setItem('tor:seen-consent', '1')
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

async function onApplyBridges(): Promise<void> {
  dirty.value = false
  await tor.applyAndRestart({
    useBridges: localUseBridges.value,
    kind: localKind.value,
    customBridges: localCustom.value,
  })
}
</script>
