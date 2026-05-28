<template>
  <Modal
    v-model:open="isOpen"
    :width="600"
    :centered="true"
    :closable="true"
    :mask-closable="false"
    :destroy-on-close="true"
    :z-index="2700"
    @cancel="handleClose"
  >
    <template #title>
      <div style="display: flex; align-items: center; gap: 12px">
        <SafetyOutlined style="font-size: 24px; color: #1890ff" />
        <span>Сохраните вашу сид-фразу</span>
      </div>
    </template>
    <SC_MnemonicModalContent>
      <SC_WarningBox>
        <SC_WarningTitle>⚠️ ВАЖНО!</SC_WarningTitle>
        <SC_WarningText>
          Сохраните сид-фразу и/или приватный ключ в безопасном месте. Если вы потеряете оба, вы не
          сможете восстановить доступ к аккаунту.
          <strong> Никогда не делитесь ими ни с кем!</strong>
        </SC_WarningText>
      </SC_WarningBox>

      <SC_EquivalenceNote v-if="hasMnemonic && hasPrivateKey">
        Сид-фраза и приватный ключ (hex) равнозначны для восстановления доступа — достаточно
        сохранить что-то одно.
      </SC_EquivalenceNote>

      <SC_MnemonicBox v-if="hasMnemonic">
        <SC_PrivateKeyLabel>Сид-фраза</SC_PrivateKeyLabel>
        <SC_MnemonicText>
          {{ formattedMnemonic }}
        </SC_MnemonicText>
        <SC_CopyIconBtn type="button" title="Копировать сид-фразу" @click="copyMnemonic">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_MnemonicBox>

      <SC_PrivateKeyBox v-if="hasPrivateKey">
        <SC_PrivateKeyLabel>Приватный ключ (hex)</SC_PrivateKeyLabel>
        <SC_PrivateKeyText>
          {{ displayPrivateKeyHex }}
        </SC_PrivateKeyText>
        <SC_CopyIconBtn type="button" title="Копировать приватный ключ" @click="copyPrivateKey">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>
    </SC_MnemonicModalContent>

    <template #footer>
      <Button type="primary" @click="handleOk"> Понятно </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { SafetyOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { recoverKeyPair, detectPrivateKeyFormat } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import {
  SC_MnemonicModalContent,
  SC_WarningBox,
  SC_WarningTitle,
  SC_WarningText,
  SC_EquivalenceNote,
  SC_MnemonicBox,
  SC_MnemonicText,
  SC_PrivateKeyBox,
  SC_PrivateKeyLabel,
  SC_PrivateKeyText,
  SC_CopyIconBtn,
} from './styled'

const props = withDefaults(
  defineProps<{
    open?: boolean
    /** Сид-фраза (12 слов). Есть только при входе/регистрации по мнемонике. */
    mnemonic?: string
    /** Приватный ключ в hex. Передаётся, если нет сид-фразы (вход по ключу). Иначе вычисляется из сид-фразы. */
    privateKeyHex?: string
  }>(),
  { open: false, mnemonic: '', privateKeyHex: '' }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const derivedPrivateKeyHex = ref('')

const isOpen = computed<boolean>({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

/** Только валидная сид-фраза (12/24 слова из словаря); иначе пусто. */
const formattedMnemonic = computed<string>(() => {
  const raw = (props.mnemonic || '').trim()
  if (!raw) return ''
  return detectPrivateKeyFormat(raw) === 'mnemonic' ? raw : ''
})

const displayPrivateKeyHex = computed<string>(() => {
  const explicit = (props.privateKeyHex || '').trim()
  if (explicit) return explicit
  return derivedPrivateKeyHex.value
})

const hasMnemonic = computed<boolean>(() => formattedMnemonic.value.length > 0)
const hasPrivateKey = computed<boolean>(() => displayPrivateKeyHex.value.length > 0)

function derivePrivateKeyFromMnemonic(): void {
  const m = formattedMnemonic.value
  if (!m) return
  try {
    const { keyPair } = recoverKeyPair(m)
    if (keyPair?.privateKey) {
      derivedPrivateKeyHex.value = Buffer.isBuffer(keyPair.privateKey)
        ? keyPair.privateKey.toString('hex')
        : String(keyPair.privateKey)
    }
  } catch {
    derivedPrivateKeyHex.value = ''
  }
}

watch(
  () => props.open,
  (newValue) => {
    if (!newValue) {
      derivedPrivateKeyHex.value = ''
    } else if (formattedMnemonic.value && !props.privateKeyHex?.trim()) {
      derivePrivateKeyFromMnemonic()
    }
  }
)

watch(
  () => props.mnemonic,
  (newMnemonic) => {
    if (!newMnemonic || !newMnemonic.trim()) return
    if ((props.privateKeyHex || '').trim()) return
    derivePrivateKeyFromMnemonic()
  },
  { immediate: true }
)

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch (err) {
      console.error('Failed to copy:', err)
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

async function copyMnemonic(): Promise<void> {
  if (!formattedMnemonic.value) return
  const ok = await copyToClipboard(formattedMnemonic.value)
  if (ok) appToast.success({ message: 'Сид-фраза скопирована' })
}

async function copyPrivateKey(): Promise<void> {
  if (!displayPrivateKeyHex.value) return
  const ok = await copyToClipboard(displayPrivateKeyHex.value)
  if (ok) appToast.success({ message: 'Приватный ключ скопирован' })
}

function handleClose(): void {
  emit('close')
  emit('update:open', false)
}

function handleOk(): void {
  handleClose()
}
</script>
