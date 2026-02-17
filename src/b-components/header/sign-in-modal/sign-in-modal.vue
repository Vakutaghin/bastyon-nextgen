<template>
  <Modal
    :key="modalKey"
    v-model:open="isOpen"
    title="Вход в аккаунт"
    :width="500"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :destroyOnClose="true"
    :z-index="2700"
    @cancel="handleCancel"
  >
    <SC_SignInForm>
      <SC_FormItem>
        <SC_FormLabel>Мнемоническая фраза или приватный ключ</SC_FormLabel>
        <SC_InputWrapper>
          <SC_InputWithToggle
            v-model:value="privateKey"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Введите 12-словную мнемоническую фразу или приватный ключ (hex/WIF)"
            :disabled="loading"
            :allowClear="true"
            @keyup.enter="handleSignIn"
          />
          <SC_PasswordToggle
            @click="showPassword = !showPassword"
            :title="showPassword ? 'Скрыть' : 'Показать'"
          >
            {{ showPassword ? '👁️' : '👁️‍🗨️' }}
          </SC_PasswordToggle>
        </SC_InputWrapper>
        <Alert
          type="info"
          :show-icon="true"
          style="margin-top: 8px;"
        >
          <template #description>
            <div>
              <strong>Мнемоническая фраза:</strong> 12 слов через пробел (например: "word1 word2 word3 ...")<br>
              <strong>Приватный ключ:</strong> hex (64 символа) или WIF формат
            </div>
          </template>
        </Alert>
      </SC_FormItem>

      <SC_ErrorMessage v-if="error">
        {{ error }}
      </SC_ErrorMessage>

      <SC_LinkToRegister>
        Еще не зарегистрированы?
        <SC_LinkButton @click="handleOpenRegister">
          Зарегистрироваться
        </SC_LinkButton>
      </SC_LinkToRegister>
    </SC_SignInForm>

    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <Button type="default" @click="handleCancel" :disabled="loading">
          Отмена
        </Button>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!privateKey || loading"
        @click="handleSignIn"
      >
        Войти
      </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useSignInModal } from './sign-in-modal'
import type { SignInModalProps, SignInModalEmits } from './types'

const p = withDefaults(defineProps<SignInModalProps>(), {
  open: false
})

const emit = defineEmits<SignInModalEmits>()

const {
  Modal,
  Button,
  Alert,
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
  modalKey,
  isOpen,
  handleSignIn,
  handleCancel,
  handleOpenRegister
} = useSignInModal(p, emit)
</script>
