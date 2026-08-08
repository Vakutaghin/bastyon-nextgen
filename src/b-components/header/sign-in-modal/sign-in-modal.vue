<template>
  <Modal
    :key="modalKey"
    v-model:open="isOpen"
    :title="t('auth.signInTitle')"
    :width="500"
    :centered="true"
    :closable="!loading"
    :maskClosable="!loading"
    :keyboard="!loading"
    :destroyOnClose="true"
    :z-index="2700"
    @cancel="handleCancel"
  >
    <SC_SignInForm>
      <SC_FormItem>
        <SC_FormLabel>{{ t('auth.mnemonicOrKeyLabel') }}</SC_FormLabel>
        <SC_InputWrapper>
          <SC_InputWithToggle
            v-model:value="privateKey"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="t('auth.mnemonicOrKeyPlaceholder')"
            :disabled="loading"
            :allowClear="true"
            @keyup.enter="handleSignIn"
          />
          <SC_PasswordToggle
            :isDisabled="loading"
            @click="!loading && (showPassword = !showPassword)"
            :title="showPassword ? t('auth.hide') : t('auth.show')"
          >
            {{ showPassword ? '👁️' : '👁️‍🗨️' }}
          </SC_PasswordToggle>
        </SC_InputWrapper>
        <SC_InfoAlert type="info" :show-icon="true">
          <template #description>
            <div>
              <strong>{{ t('auth.mnemonicLabel') }}</strong> {{ t('auth.mnemonicHint') }}<br />
              <strong>{{ t('auth.privateKeyLabel') }}</strong> {{ t('auth.privateKeyHint') }}
            </div>
          </template>
        </SC_InfoAlert>

        <SC_QrToggleRow>
          <Button type="link" size="small" :disabled="loading" @click="toggleQrScanner">
            <template #icon><QrcodeOutlined /></template>
            {{ showQrScanner ? t('auth.qrHide') : t('auth.scanQr') }}
          </Button>
        </SC_QrToggleRow>

        <QrScanner v-if="showQrScanner" @decoded="handleQrDecoded" />
      </SC_FormItem>

      <SC_ErrorMessage v-if="error">
        {{ error }}
      </SC_ErrorMessage>

      <SC_LinkToRegister>
        {{ t('auth.notRegisteredYet') }}
        <SC_LinkButton :isDisabled="loading" @click="handleOpenRegister">
          {{ t('auth.register') }}
        </SC_LinkButton>
      </SC_LinkToRegister>
    </SC_SignInForm>

    <template #footer>
      <SC_ModalActions>
        <!-- Во время входа «Отмена» остаётся активной — это единственный явный
             способ прервать процесс (крестик/маска/Esc заблокированы). -->
        <Button type="default" :disabled="isCancelling" @click="handleCancel">
          {{ isCancelling ? t('auth.cancelling') : t('auth.cancel') }}
        </Button>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!privateKey || loading"
          @click="handleSignIn"
        >
          {{ t('auth.signIn') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { QrcodeOutlined } from '@ant-design/icons-vue'
import { useSignInModal } from './sign-in-modal'
import type { SignInModalProps, SignInModalEmits } from './types'
import { SC_ModalActions } from '@/components/modal'
import { SC_InfoAlert, SC_QrToggleRow } from './styled'
import QrScanner from '@/b-components/qr-scanner/qr-scanner.vue'

const { t } = useI18n()

const p = withDefaults(defineProps<SignInModalProps>(), {
  open: false,
})

const emit = defineEmits<SignInModalEmits>()

const {
  Modal,
  Button,
  SC_SignInForm,
  SC_FormItem,
  SC_FormLabel,
  SC_InputWrapper,
  SC_InputWithToggle,
  SC_PasswordToggle,
  SC_ErrorMessage,
  SC_LinkToRegister,
  SC_LinkButton,
  privateKey,
  loading,
  error,
  showPassword,
  showQrScanner,
  modalKey,
  isOpen,
  isCancelling,
  handleSignIn,
  handleCancel,
  handleOpenRegister,
  toggleQrScanner,
  handleQrDecoded,
} = useSignInModal(p, emit)
</script>
