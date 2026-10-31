<template>
  <Teleport to="body">
    <SC_LockScreen
      v-if="appLock.locked"
      ref="rootRef"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <SC_LockBody v-if="view === 'code'">
        <SC_LockLogo :src="logoSrc" alt="" />
        <SC_LockTitle>{{ title }}</SC_LockTitle>
        <SC_LockHint :class="{ error: !!entry.hint.value }" aria-live="polite">
          {{ entry.hint.value }}
        </SC_LockHint>
        <PinPad
          v-if="appLock.kind === 'pin'"
          ref="inputRef"
          :length="appLock.digits"
          :disabled="entry.paused.value"
          keyboard
          @complete="onCode"
        />
        <PatternGrid
          v-else
          ref="inputRef"
          :disabled="entry.paused.value"
          @complete="(dots) => onCode(patternToCode(dots))"
        />
        <SC_LockLink type="button" @click="openRecover">
          {{ appLock.kind === 'pattern' ? t('appLock.forgotPattern') : t('appLock.forgotPin') }}
        </SC_LockLink>
      </SC_LockBody>

      <!-- Код забыт: фраза или ключ любого аккаунта с устройства снимают замок. -->
      <SC_LockBody v-else-if="view === 'recover'" class="form">
        <SC_LockTitle>{{ t('appLock.recoverTitle') }}</SC_LockTitle>
        <SC_LockText>{{ t('appLock.recoverText') }}</SC_LockText>
        <Input.TextArea
          ref="secretRef"
          v-model:value="secret"
          :auto-size="{ minRows: 3, maxRows: 5 }"
          :placeholder="t('appLock.recoverPlaceholder')"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <SC_LockHint v-if="recoverError" class="error">{{ recoverError }}</SC_LockHint>
        <Button
          type="primary"
          block
          :loading="recovering"
          :disabled="!secret.trim()"
          @click="onRecover"
        >
          {{ t('appLock.recoverSubmit') }}
        </Button>
        <SC_LockLink type="button" @click="view = 'code'">{{ t('appLock.back') }}</SC_LockLink>
        <SC_LockLink type="button" class="danger" @click="view = 'signout'">
          {{ t('appLock.noBackup') }}
        </SC_LockLink>
      </SC_LockBody>

      <!-- Записи нет: остаётся выйти из всех аккаунтов на устройстве. -->
      <SC_LockBody v-else class="form">
        <SC_LockTitle>{{ t('appLock.signOutTitle') }}</SC_LockTitle>
        <SC_LockText>{{ t('appLock.signOutText') }}</SC_LockText>
        <Button danger block :loading="signingOut" @click="onSignOut">
          {{ t('appLock.signOutConfirm') }}
        </Button>
        <SC_LockLink type="button" @click="view = 'recover'">{{ t('appLock.back') }}</SC_LockLink>
      </SC_LockBody>
    </SC_LockScreen>
  </Teleport>
</template>

<script setup lang="ts">
// Экран замка поверх всего приложения. Всё под ним — inert: ни Tab, ни
// экранный диктор, ни клавиатурные сочетания туда не попадают. Ролик во весь
// экран из полноэкранного режима выходит: иначе он остался бы поверх замка.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button, Input } from 'ant-design-vue'

import { useAppLockStore } from '@/stores/app-lock-store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useModalStore } from '@/stores/modal-store'
import { useTheme } from '@/composables/use-theme'
import { pushBackHandler } from '@/composables/use-back-button'
import { patternToCode } from '@/helpers/app-lock/app-lock-config'
import { logoData } from '@/b-components/header/dummy-data/logo-data'
import { appToast } from '@/b-components/app-toast'
import PinPad from './pin-pad.vue'
import PatternGrid from './pattern-grid.vue'
import { useCodeEntry, type CodeInput } from './use-code-entry'
import {
  SC_LockBody,
  SC_LockHint,
  SC_LockLink,
  SC_LockLogo,
  SC_LockScreen,
  SC_LockText,
  SC_LockTitle,
} from './styled'

const { t } = useI18n()
const router = useRouter()
const appLock = useAppLockStore()
const { isDark } = useTheme()

const view = ref<'code' | 'recover' | 'signout'>('code')
const rootRef = ref<{ $el: HTMLElement } | HTMLElement | null>(null)
const inputRef = ref<CodeInput | null>(null)
const secretRef = ref<{ focus: () => void } | null>(null)

const logoSrc = computed(() => (isDark.value ? logoData.logoWhite : logoData.logoBlack))
const title = computed(() =>
  appLock.kind === 'pattern' ? t('appLock.drawPattern') : t('appLock.enterPin')
)

const entry = useCodeEntry({ kind: () => appLock.kind, submit: (code) => appLock.unlock(code) })

async function onCode(code: string): Promise<void> {
  await entry.enter(code, inputRef.value)
}

// ─── код забыт ────────────────────────────────────────────────────────────────

const secret = ref('')
const recovering = ref(false)
const recoverError = ref('')

function openRecover(): void {
  recoverError.value = ''
  view.value = 'recover'
  void nextTick(() => secretRef.value?.focus())
}

async function onRecover(): Promise<void> {
  if (recovering.value) return
  recovering.value = true
  recoverError.value = ''
  try {
    const res = await appLock.recover(secret.value)
    if (res === 'ok') appToast.success({ message: t('appLock.recoverDone') })
    else if (res === 'unknown') recoverError.value = t('appLock.recoverUnknown')
    else recoverError.value = t('appLock.recoverInvalid')
  } finally {
    // Фразу в состоянии не держим ни после успеха, ни после ошибки.
    secret.value = ''
    recovering.value = false
  }
}

const signingOut = ref(false)

async function onSignOut(): Promise<void> {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await useAuthStore().signOut()
    // signOut стирает замок вместе с сейфом; снимаем и экран.
    appLock.disable()
    void router.push('/')
    useModalStore().openAuthModal('login')
  } finally {
    signingOut.value = false
  }
}

// ─── что под замком ───────────────────────────────────────────────────────────

const inerted = new Set<Element>()
let observer: MutationObserver | null = null
let releaseBack: (() => void) | null = null

function rootEl(): HTMLElement | null {
  const r = rootRef.value
  return r instanceof HTMLElement ? r : (r?.$el ?? null)
}

function inertAround(root: HTMLElement): void {
  const apply = (): void => {
    for (const el of Array.from(document.body.children)) {
      if (el === root || el.hasAttribute('inert')) continue
      el.setAttribute('inert', '')
      inerted.add(el)
    }
  }
  apply()
  // Тост или окно, появившиеся под замком, тоже не должны ловить фокус.
  observer = new MutationObserver(apply)
  observer.observe(document.body, { childList: true })
}

function releaseInert(): void {
  observer?.disconnect()
  observer = null
  for (const el of inerted) el.removeAttribute('inert')
  inerted.clear()
}

async function onLocked(): Promise<void> {
  view.value = 'code'
  secret.value = ''
  recoverError.value = ''
  entry.reset()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  // «Назад» на Android на замке сворачивает приложение, а не листает то, что под ним.
  releaseBack = pushBackHandler(() => {
    if (view.value !== 'code') {
      view.value = view.value === 'signout' ? 'recover' : 'code'
      return true
    }
    void import('@capacitor/app').then(({ App }) => App.minimizeApp()).catch(() => {})
    return true
  })
  await nextTick()
  const root = rootEl()
  if (!root) return
  inertAround(root)
  root.focus({ preventScroll: true })
}

function onUnlocked(): void {
  releaseInert()
  releaseBack?.()
  releaseBack = null
}

watch(
  () => appLock.locked,
  (locked) => {
    if (locked) void onLocked()
    else onUnlocked()
  },
  { immediate: true }
)

let stop: (() => void) | null = null
onMounted(() => {
  stop = appLock.start()
})
onBeforeUnmount(() => {
  stop?.()
  onUnlocked()
})
</script>
