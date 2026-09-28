import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

// Поле календаря в оформлении Nuxt UI — как поля ввода и Select рядом:
// фон страницы, рамка accented, радиус 6, высота 36, текст highlighted; на
// hover рамка не меняется, в фокусе — акцентная рамка и ореол (из темы antd).
// Панель рисуется вне обёртки — её стили в style.css (.ui-picker-dropdown).
export const SC_Picker = styled.div`
  width: 100%;
  min-width: 0;

  .ant-picker {
    width: 100%;
    background: var(--ui-bg);
    border-color: var(--ui-border-accented);
  }

  .ant-picker:hover:not(.ant-picker-focused, .ant-picker-disabled) {
    border-color: var(--ui-border-accented);
  }

  .ant-picker .ant-picker-input > input {
    color: var(--ui-text-highlighted);
    cursor: pointer;
  }

  .ant-picker .ant-picker-input > input::placeholder {
    color: var(--ui-text-dimmed);
  }

  .ant-picker .ant-picker-suffix,
  .ant-picker .ant-picker-clear {
    font-size: 16px;
    color: var(--ui-text-dimmed);
  }

  .ant-picker.ant-picker-disabled {
    background: var(--ui-bg);
    opacity: 0.75;
  }

  /* На телефоне 16px, как у полей ввода (field-styles.ts). */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .ant-picker-large .ant-picker-input > input {
      font-size: 16px;
    }
  }
`

export const SC_Placeholder = styled.div`
  ${nuxtField}
  height: 36px;
  overflow: hidden;
  color: var(--ui-text-dimmed);
  white-space: nowrap;
`
