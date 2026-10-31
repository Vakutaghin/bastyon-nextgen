<template>
  <!-- Подтверждение кодом замка перед опасным: показать фразу, сменить или снять код. -->
  <Modal
    :open="appLock.confirmOpen"
    :width="380"
    :centered="true"
    :footer="null"
    :z-index="Z_INDEX.CONFIRM + 50"
    :title="t('appLock.confirmTitle')"
    :destroy-on-close="true"
    @cancel="appLock.finishConfirm(false)"
  >
    <SC_ConfirmBody>
      <SC_LockHint :class="{ error: !!entry.hint.value }" aria-live="polite">
        {{ entry.hint.value || title }}
      </SC_LockHint>
      <PinPad
        v-if="appLock.kind === 'pin'"
        ref="inputRef"
        :length="appLock.digits"
        :disabled="entry.paused.value"
        keyboard
        compact
        @complete="onCode"
      />
      <PatternGrid
        v-else-if="appLock.kind === 'pattern'"
        ref="inputRef"
        :disabled="entry.paused.value"
        compact
        @complete="(dots) => onCode(patternToCode(dots))"
      />
    </SC_ConfirmBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'

import { useAppLockStore } from '@/stores/app-lock-store'
import { useCloseOnBack } from '@/composables/use-back-button'
import { patternToCode } from '@/helpers/app-lock/app-lock-config'
import { Z_INDEX } from '@/styles/design-tokens'
import PinPad from './pin-pad.vue'
import PatternGrid from './pattern-grid.vue'
import { useCodeEntry, type CodeInput } from './use-code-entry'
import { SC_ConfirmBody, SC_LockHint } from './styled'

const { t } = useI18n()
const appLock = useAppLockStore()
const inputRef = ref<CodeInput | null>(null)

const title = computed(() =>
  appLock.kind === 'pattern' ? t('appLock.drawPattern') : t('appLock.enterPin')
)

const entry = useCodeEntry({ kind: () => appLock.kind, submit: (code) => appLock.checkCode(code) })

watch(
  () => appLock.confirmOpen,
  (open) => {
    if (open) entry.reset()
  }
)

useCloseOnBack(
  () => appLock.confirmOpen,
  () => appLock.finishConfirm(false)
)

async function onCode(code: string): Promise<void> {
  if (await entry.enter(code, inputRef.value)) appLock.finishConfirm(true)
}
</script>
