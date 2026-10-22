<template>
  <SC_ChainPeople>
    <SC_ChainPerson
      v-for="person in shown"
      :key="person.address"
      type="button"
      :title="person.address"
      @click="openAccount(person.address)"
    >
      {{ userName(person.address, person.name) }}
      <SC_ChainPersonValue v-if="person.value">★{{ person.value }}</SC_ChainPersonValue>
    </SC_ChainPerson>
    <SC_ChainMuted v-if="hidden > 0">{{ t('chainInfo.andMore', { n: hidden }) }}</SC_ChainMuted>
  </SC_ChainPeople>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { userName } from '@/services/user-names'
import { CHAIN_LINK_KEY } from '../chain-link'
import type { ContentActor } from '../chain-info-data'
import {
  SC_ChainPeople,
  SC_ChainPerson,
  SC_ChainPersonValue,
  SC_ChainMuted,
} from '../chain-info.styled'

defineOptions({ name: 'ChainPeople' })

const p = withDefaults(defineProps<{ people: readonly ContentActor[]; limit?: number }>(), {
  limit: 40,
})

const { t } = useI18n()
const openInChainModal = inject(CHAIN_LINK_KEY, null)

const shown = computed(() => p.people.slice(0, p.limit))
const hidden = computed(() => Math.max(0, p.people.length - p.limit))

function openAccount(address: string): void {
  openInChainModal?.({ kind: 'account', address })
}
</script>
