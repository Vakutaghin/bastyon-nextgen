<template>
  <SC_Flow>
    <SC_Steps>
      <SC_Step v-for="(step, index) in steps" :key="step.key" :class="step.key">
        <SC_StepIcon :class="step.key" aria-hidden="true"
          ><component :is="step.icon"
        /></SC_StepIcon>
        <SC_StepNumber :class="step.key" aria-hidden="true">{{ index + 1 }}</SC_StepNumber>
        <SC_StepTitle>{{ step.title }}</SC_StepTitle>
        <SC_StepText>{{ step.text }}</SC_StepText>
      </SC_Step>
    </SC_Steps>
    <SC_Loop>
      <SC_LoopIcon aria-hidden="true"><SyncOutlined /></SC_LoopIcon>
      <span>{{ t('monetization.flowLoop') }}</span>
    </SC_Loop>
  </SC_Flow>
</template>

<script setup lang="ts">
// Схема программы монетизации — тот же круг, что на картинке прежнего
// приложения: рекламодатель → реклама → активность читателей → выплата автору,
// а монеты автора через биржу снова доходят до рекламодателей.
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MegaphoneIcon,
  MessageOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@/components/icons'
import {
  SC_Flow,
  SC_Loop,
  SC_LoopIcon,
  SC_Step,
  SC_StepIcon,
  SC_StepNumber,
  SC_Steps,
  SC_StepText,
  SC_StepTitle,
} from './monetization-flow.styled'

interface FlowStep {
  key: 'advertiser' | 'boost' | 'readers' | 'payout'
  icon: Component
  title: string
  text: string
}

const { t } = useI18n()

const steps = computed<FlowStep[]>(() => [
  {
    key: 'advertiser',
    icon: MegaphoneIcon,
    title: t('monetization.flowAdvertiserTitle'),
    text: t('monetization.flowAdvertiserText'),
  },
  {
    key: 'boost',
    icon: ThunderboltOutlined,
    title: t('monetization.flowBoostTitle'),
    text: t('monetization.flowBoostText'),
  },
  {
    key: 'readers',
    icon: MessageOutlined,
    title: t('monetization.flowReadersTitle'),
    text: t('monetization.flowReadersText'),
  },
  {
    key: 'payout',
    icon: WalletOutlined,
    title: t('monetization.flowPayoutTitle'),
    text: t('monetization.flowPayoutText'),
  },
])
</script>
