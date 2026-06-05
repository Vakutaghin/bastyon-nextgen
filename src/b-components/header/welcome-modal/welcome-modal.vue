<template>
  <Modal
    v-model:open="isOpen"
    :title="t('auth.welcome.title')"
    :width="440"
    :centered="true"
    :closable="true"
    :mask-closable="false"
    :z-index="2750"
    :footer="null"
    @cancel="finish"
  >
    <SC_Welcome>
      <SC_WelcomeIcon>
        <component :is="current.icon" />
      </SC_WelcomeIcon>
      <SC_WelcomeTitle>{{ current.title }}</SC_WelcomeTitle>
      <SC_WelcomeDesc>{{ current.desc }}</SC_WelcomeDesc>

      <SC_WelcomeDots>
        <SC_WelcomeDot v-for="(s, i) in steps" :key="i" :class="{ active: i === step }" />
      </SC_WelcomeDots>

      <SC_WelcomeActions>
        <SC_WelcomeSkip @click="finish">{{ t('auth.welcome.skip') }}</SC_WelcomeSkip>
        <SC_WelcomeNav>
          <SC_WelcomeBack v-if="step > 0" @click="step--">
            {{ t('auth.welcome.back') }}
          </SC_WelcomeBack>
          <SC_WelcomeNext v-if="!isLast" @click="step++">
            {{ t('auth.welcome.next') }}
          </SC_WelcomeNext>
          <SC_WelcomeNext v-else @click="finish">
            {{ t('auth.welcome.finish') }}
          </SC_WelcomeNext>
        </SC_WelcomeNav>
      </SC_WelcomeActions>
    </SC_Welcome>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { SmileOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import {
  SC_Welcome,
  SC_WelcomeIcon,
  SC_WelcomeTitle,
  SC_WelcomeDesc,
  SC_WelcomeDots,
  SC_WelcomeDot,
  SC_WelcomeActions,
  SC_WelcomeSkip,
  SC_WelcomeNav,
  SC_WelcomeBack,
  SC_WelcomeNext,
} from './styled'

const props = defineProps<{ open: boolean; nickname?: string }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'close'): void }>()

const { t } = useI18n()
const step = ref(0)

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

interface WelcomeStep {
  icon: Component
  title: string
  desc: string
}

const steps = computed<WelcomeStep[]>(() => [
  {
    icon: SmileOutlined,
    title: props.nickname
      ? t('auth.welcome.step1Titlenamed', { name: props.nickname })
      : t('auth.welcome.step1Title'),
    desc: t('auth.welcome.step1Desc'),
  },
  {
    icon: UserOutlined,
    title: t('auth.welcome.step2Title'),
    desc: t('auth.welcome.step2Desc'),
  },
  {
    icon: SafetyCertificateOutlined,
    title: t('auth.welcome.step3Title'),
    desc: t('auth.welcome.step3Desc'),
  },
])

const current = computed<WelcomeStep>(() => steps.value[step.value] ?? steps.value[0])
const isLast = computed<boolean>(() => step.value >= steps.value.length - 1)

// Сбрасываем на первый шаг при каждом открытии.
watch(
  () => props.open,
  (open) => {
    if (open) step.value = 0
  }
)

function finish(): void {
  emit('update:open', false)
  emit('close')
}
</script>
