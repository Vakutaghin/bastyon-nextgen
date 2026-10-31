<template>
  <!-- Новый код замка: вид и длина → придумать → повторить. -->
  <Modal
    :open="open"
    :width="400"
    :centered="true"
    :footer="null"
    :z-index="2800"
    :title="kind === 'pattern' ? t('appLock.setPattern') : t('appLock.setPin')"
    :destroy-on-close="true"
    @cancel="emit('cancel')"
  >
    <SC_SetupBody>
      <template v-if="step === 'create'">
        <Segmented v-model:value="kind" :options="kindOptions" block />
        <Segmented
          v-if="kind === 'pin'"
          v-model:value="digits"
          :options="digitOptions"
          :aria-label="t('appLock.kindPin')"
        />
      </template>
      <SC_LockHint :class="{ error: !!error }" aria-live="polite">{{
        error || prompt
      }}</SC_LockHint>
      <PinPad
        v-if="kind === 'pin'"
        ref="inputRef"
        :length="digits"
        :disabled="saving"
        keyboard
        compact
        @complete="accept"
      />
      <PatternGrid v-else ref="inputRef" :disabled="saving" compact @complete="onPattern" />
      <SC_SecurityDesc>{{ t('appLock.forgetHint') }}</SC_SecurityDesc>
    </SC_SetupBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Segmented } from 'ant-design-vue'

import { useAppLockStore } from '@/stores/app-lock-store'
import {
  PATTERN_MIN_DOTS,
  PIN_LENGTHS,
  patternToCode,
  type LockKind,
  type PinLength,
} from '@/helpers/app-lock/app-lock-config'
import { appToast } from '@/b-components/app-toast'
import PinPad from '@/components/app-lock/pin-pad.vue'
import PatternGrid from '@/components/app-lock/pattern-grid.vue'
import { SC_LockHint } from '@/components/app-lock/styled'
import type { CodeInput } from '@/components/app-lock/use-code-entry'
import { SC_SecurityDesc } from './security-section.styled'
import { SC_SetupBody } from './app-lock-section.styled'

const props = defineProps<{ open: boolean; initialKind: LockKind }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const { t } = useI18n()
const appLock = useAppLockStore()

const kind = ref<LockKind>('pin')
const digits = ref<PinLength>(4)
const step = ref<'create' | 'repeat'>('create')
const error = ref('')
const saving = ref(false)
const inputRef = ref<CodeInput | null>(null)
// Первый ввод — до повтора, не в реактивном состоянии.
let first: string | null = null

const kindOptions = computed(() => [
  { value: 'pin', label: t('appLock.kindPin') },
  { value: 'pattern', label: t('appLock.kindPattern') },
])
const digitOptions = computed(() =>
  PIN_LENGTHS.map((n) => ({
    value: n,
    label: n === 4 ? t('appLock.digits4') : t('appLock.digits6'),
  }))
)

const prompt = computed(() => {
  if (kind.value === 'pattern') {
    return step.value === 'create' ? t('appLock.createPattern') : t('appLock.repeatPattern')
  }
  return step.value === 'create' ? t('appLock.createPin') : t('appLock.repeatPin')
})

function restart(): void {
  first = null
  step.value = 'create'
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      first = null
      return
    }
    kind.value = props.initialKind
    digits.value = appLock.kind === 'pin' ? (appLock.digits as PinLength) : 4
    error.value = ''
    restart()
  },
  { immediate: true }
)

watch([kind, digits], () => {
  error.value = ''
  restart()
  inputRef.value?.clear()
})

async function accept(code: string): Promise<void> {
  if (step.value === 'create') {
    first = code
    error.value = ''
    step.value = 'repeat'
    // Цифры гаснут сразу: повтор набирают без паузы. Нарисованный ключ виден
    // мгновение — видно, что он принят; новое касание сотрёт его и раньше.
    if (kind.value === 'pattern') setTimeout(() => inputRef.value?.clear(), 250)
    else inputRef.value?.clear()
    return
  }
  if (code !== first) {
    inputRef.value?.fail()
    error.value = t('appLock.mismatch')
    restart()
    return
  }
  first = null
  saving.value = true
  try {
    const ok = await appLock.enable(kind.value, code)
    if (!ok) {
      inputRef.value?.fail()
      error.value = t('appLock.saveFailed')
      restart()
      return
    }
    appToast.success({
      message: kind.value === 'pattern' ? t('appLock.patternSet') : t('appLock.pinSet'),
    })
    emit('done')
  } finally {
    saving.value = false
  }
}

function onPattern(dots: number[]): void {
  if (dots.length < PATTERN_MIN_DOTS) {
    inputRef.value?.fail()
    error.value = t('appLock.patternTooShort')
    return
  }
  void accept(patternToCode(dots))
}
</script>
