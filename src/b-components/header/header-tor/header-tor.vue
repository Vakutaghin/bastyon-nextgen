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
          <SC_TorTitle style="font-size: 12px">Мосты</SC_TorTitle>
          <RadioGroup
            :value="localKind"
            @change="(e: RadioChangeEvent) => onSelectKind(e.target.value as TorBridgeKind)"
          >
            <Radio value="none">Без мостов</Radio>
            <Radio value="snowflake">Snowflake</Radio>
            <Radio value="obfs4">OBFS4 (встроенные)</Radio>
            <Radio value="custom">Свои OBFS4</Radio>
          </RadioGroup>
          <SC_TorTextarea
            v-if="localKind === 'custom'"
            :value="localCustom"
            placeholder="obfs4 IP:PORT FINGERPRINT cert=... iat-mode=..."
            @input="onCustomTextareaInput"
          />
          <SC_TorActions>
            <Button size="small" type="primary" :disabled="!dirty" @click="onApplyBridges">
              Применить
            </Button>
          </SC_TorActions>
          <SC_TorHint> Изменение мостов перезапустит Tor. </SC_TorHint>
        </SC_TorBridgeBlock>

        <SC_TorHint v-if="!available"> Доступно только в десктопном приложении. </SC_TorHint>
      </SC_TorMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
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
      return enabled.value ? 'Tor выключается…' : 'Tor выключен'
    case 'installing':
      return install.value
        ? `Загрузка: ${Math.round(install.value.fraction * 100)}% — ${install.value.message}`
        : 'Установка Tor…'
    case 'starting':
      return 'Запуск процесса…'
    case 'bootstrapping':
      return `Подключение к сети Tor: ${bootstrapPct.value}%`
    case 'ready':
      return 'Подключено к сети Tor'
    case 'failed':
      return message.value ? `Ошибка: ${message.value}` : 'Ошибка'
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
      title: 'Tor доступен только в десктопном приложении',
      content:
        'Откройте Bastyon в приложении для рабочего стола — браузерная версия не поддерживает встроенный Tor.',
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
          title: 'Включить Tor?',
          content:
            'При первом запуске будет загружен Tor (~30 МБ). Это может занять минуту. ' +
            'После подключения весь сетевой трафик приложения пойдёт через сеть Tor. ' +
            'Чат Matrix может работать с задержками.',
          okText: 'Включить',
          cancelText: 'Отмена',
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
