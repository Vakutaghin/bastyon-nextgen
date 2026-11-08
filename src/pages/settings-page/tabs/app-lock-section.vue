<template>
  <!-- Вход в приложение: пин-код или графический ключ (stores/app-lock-store). -->
  <SC_SecurityCard>
    <SC_SecurityLevel
      >{{ t('appLock.sectionTitle') }} <HelpLink topic="device-protection"
    /></SC_SecurityLevel>

    <template v-if="!appLock.enabled">
      <SC_SecurityDesc>
        {{ available ? t('appLock.descOff') : t('appLock.descUnavailable') }}
      </SC_SecurityDesc>
      <SC_AppLockActions v-if="available">
        <Button type="primary" @click="openSetup('pin')">{{ t('appLock.setPin') }}</Button>
        <Button @click="openSetup('pattern')">{{ t('appLock.setPattern') }}</Button>
      </SC_AppLockActions>
    </template>

    <template v-else>
      <SC_SecurityDesc>
        {{
          appLock.kind === 'pattern'
            ? t('appLock.descPattern')
            : t('appLock.descPin', { n: appLock.digits })
        }}
        <template v-if="passphrase">{{ t('appLock.descPassphrase') }}</template>
      </SC_SecurityDesc>
      <SC_AppLockRow>
        {{ t('appLock.autoLockLabel') }}
        <Select
          :value="appLock.autoLockAfter"
          :options="autoLockOptions"
          size="middle"
          @change="onAutoLock"
        />
        <SC_AppLockHint>{{ t('appLock.autoLockHint') }}</SC_AppLockHint>
      </SC_AppLockRow>
      <SC_AppLockActions>
        <Button @click="appLock.lock()">{{ t('appLock.lockNow') }}</Button>
        <Button @click="onChange">{{ t('appLock.change') }}</Button>
        <Button danger @click="onDisable">{{ t('appLock.disable') }}</Button>
      </SC_AppLockActions>
    </template>
  </SC_SecurityCard>

  <AppLockSetupModal
    :open="setupOpen"
    :initial-kind="setupKind"
    @done="setupOpen = false"
    @cancel="setupOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'

import Select, { type SelectValue } from '@/components/select'
import { useAppLockStore } from '@/stores/app-lock-store'
import { getVaultLevel } from '@/blockchain/storage'
import {
  AUTO_LOCK_OPTIONS,
  type AutoLockAfter,
  type LockKind,
} from '@/helpers/app-lock/app-lock-config'
import { appToast } from '@/b-components/app-toast'
import AppLockSetupModal from './app-lock-setup-modal.vue'
import { SC_SecurityCard, SC_SecurityDesc, SC_SecurityLevel } from './security-section.styled'
import { SC_AppLockActions, SC_AppLockHint, SC_AppLockRow } from './app-lock-section.styled'
import HelpLink from '@/b-components/help/help-link.vue'

const { t } = useI18n()
const appLock = useAppLockStore()

// Сейф — модульный синглтон, не реактивный: читаем при открытии вкладки.
const available = ref(appLock.available())
const passphrase = ref(getVaultLevel() === 'passphrase')

onMounted(() => {
  appLock.refresh()
  available.value = appLock.available()
  passphrase.value = getVaultLevel() === 'passphrase'
})

const autoLockOptions = computed(() =>
  AUTO_LOCK_OPTIONS.map((value) => ({ value, label: t(`appLock.autoLock.${value}`) }))
)

function onAutoLock(value: SelectValue): void {
  appLock.setAutoLock(value as AutoLockAfter)
}

const setupOpen = ref(false)
const setupKind = ref<LockKind>('pin')

function openSetup(kind: LockKind): void {
  setupKind.value = kind
  setupOpen.value = true
}

async function onChange(): Promise<void> {
  if (!(await appLock.confirm())) return
  openSetup(appLock.kind ?? 'pin')
}

async function onDisable(): Promise<void> {
  if (!(await appLock.confirm())) return
  appLock.disable()
  appToast.success({ message: t('appLock.disabled') })
}
</script>
