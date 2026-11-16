<template>
  <SC_DevUiPage>
    <SC_DevUiTitle>Витрина компонентов</SC_DevUiTitle>
    <SC_DevUiLead>
      Общие компоненты из @/components во всех вариантах и состояниях. Страница есть только в
      dev-сборке. Тему и режим контраста переключать в шапке и настройках.
    </SC_DevUiLead>
    <ButtonSection />
    <FeedbackSection />
    <ChoiceSection />
    <FieldsSection />
    <SelectSection />
    <DateSection />
    <DisplaySection />
    <ToastSection />
    <FloatingSection />
  </SC_DevUiPage>
</template>

<script setup lang="ts">
// Витрина своих компонентов, которые заменяют ant-design-vue: место для
// визуальной сверки в обеих темах и для проверок с клавиатуры. Каждый новый
// компонент добавляет сюда свой раздел (sections/<имя>-section.vue).
import ButtonSection from './sections/button-section.vue'
import FeedbackSection from './sections/feedback-section.vue'
import ChoiceSection from './sections/choice-section.vue'
import FieldsSection from './sections/fields-section.vue'
import SelectSection from './sections/select-section.vue'
import DateSection from './sections/date-section.vue'
import DisplaySection from './sections/display-section.vue'
import ToastSection from './sections/toast-section.vue'
import FloatingSection from './sections/floating-section.vue'
import { SC_DevUiLead, SC_DevUiPage, SC_DevUiTitle } from './dev-ui-page.styled'
</script>
