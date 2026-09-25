import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Выпадающий список в оформлении Nuxt UI (USelect, вариант outline) — как поле
// ввода рядом (field-styles.ts): фон страницы, рамка accented, радиус 6, текст
// highlighted; на hover рамка не меняется, в фокусе — акцентная рамка и ореол;
// шеврон 20px dimmed. Радиусы, размер текста и ореол antd берёт из темы
// (styles/antd-theme.ts), здесь — где Nuxt расходится с antd.
// Список рисуется вне обёртки — его стили в style.css (.ui-select-dropdown).
export const SC_Select = styled.div`
  width: 100%;
  min-width: 0;

  .ant-select {
    width: 100%;
    color: var(--ui-text-highlighted);
  }

  .ant-select:not(.ant-select-customize-input) .ant-select-selector {
    background: var(--ui-bg);
    border-color: var(--ui-border-accented);
  }

  /* Наведение и фокус: у antd здесь шесть классов, поэтому добираем
     специфичность классами, которые у нашего селекта есть всегда. */
  .ant-select.ant-select-single.ant-select-show-arrow:not(
      .ant-select-focused,
      .ant-select-disabled
    ):hover
    .ant-select-selector {
    border-color: var(--ui-border-accented);
  }

  .ant-select.ant-select-single.ant-select-show-arrow.ant-select-focused:not(.ant-select-disabled)
    .ant-select-selector {
    border-color: var(--ui-primary);
  }

  .ant-select-selection-placeholder {
    color: var(--ui-text-dimmed);
  }

  /* antd гасит значение до цвета плейсхолдера, пока список открыт; у Nuxt нет. */
  .ant-select-single.ant-select-open.ant-select .ant-select-selection-item {
    color: var(--ui-text-highlighted);
  }

  .ant-select .ant-select-arrow {
    width: 20px;
    height: 20px;
    margin-top: -10px;
    font-size: 20px;
    color: var(--ui-text-dimmed);
  }

  .ant-select-single.ant-select-show-arrow.ant-select .ant-select-selection-item,
  .ant-select-single.ant-select-show-arrow.ant-select .ant-select-selection-placeholder {
    padding-inline-end: 26px;
  }

  .ant-select-disabled.ant-select:not(.ant-select-customize-input) .ant-select-selector {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg);
    opacity: 0.75;
  }

  /* На телефоне 16px, как у полей ввода (field-styles.ts): поля рядом одного кегля. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .ant-select-single.ant-select-lg {
      font-size: 16px;
    }
  }
`
