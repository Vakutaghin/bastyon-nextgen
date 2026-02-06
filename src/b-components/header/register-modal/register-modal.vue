<template>
  <Modal
    v-model:open="isOpen"
    title="Регистрация"
    :width="500"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :destroyOnClose="true"
    @cancel="handleCancel"
  >
    <SC_RegisterForm>
      <SC_FormItem>
        <SC_FormLabel>
          Псевдоним
        </SC_FormLabel>
        <SC_InputWrapper>
          <Input
            v-model:value="nickname"
            placeholder="Введите псевдоним"
            :disabled="loading"
            :allowClear="true"
            @keyup.enter="handleRegister"
          />
        </SC_InputWrapper>
        <SC_FormHint>
          Только латинские буквы, цифры и нижнее подчеркивание. Русские буквы автоматически транслитерируются.
        </SC_FormHint>
      </SC_FormItem>

      <SC_FormItem>
        <SC_FormLabel>
          Email
          <SC_FormLabelOptional>(необязательно)</SC_FormLabelOptional>
        </SC_FormLabel>
        <SC_InputWrapper>
          <Input
            v-model:value="email"
            type="email"
            placeholder="Введите email"
            :disabled="loading"
            :allowClear="true"
            @keyup.enter="handleRegister"
          />
        </SC_InputWrapper>
      </SC_FormItem>

      <SC_ErrorMessage v-if="error">
        {{ error }}
      </SC_ErrorMessage>

      <SC_LinkToSignIn>
        Уже зарегистрированы?
        <SC_LinkButton @click="handleOpenSignIn">
          Войти
        </SC_LinkButton>
      </SC_LinkToSignIn>
    </SC_RegisterForm>

    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <Button type="default" @click="handleCancel" :disabled="loading">
          Отмена
        </Button>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!isFormValid || loading"
          @click="handleRegister"
        >
          Зарегистрироваться
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script>
import { registerModalOptions } from './register-modal.ts'

export default registerModalOptions
</script>
