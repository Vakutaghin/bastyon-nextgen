import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Поиск в оформлении Nuxt UI: поле как UInput (фон страницы, рамка accented,
// радиус 6, в фокусе — акцентная рамка и ореол), без «пилюли».
export const SC_InputSearch = styled.div`
  width: 45%;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    flex-shrink: 1;
  }

  /* Antd Input.Search не телепортится — вложенные селекторы работают напрямую
     (:deep() в vue3-styled-components не функционирует). При allow-clear antd
     оборачивает input в .ant-input-affix-wrapper — фон и рамку рисует он. */
  .ant-input-affix-wrapper,
  .ant-input-search .ant-input {
    background: var(--ui-bg);
    color: var(--ui-text-highlighted);
    border-color: var(--ui-border-accented);
  }

  /* Внутренний input внутри affix-wrapper прозрачный — фон несёт обёртка. */
  .ant-input-affix-wrapper > .ant-input {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ant-input-affix-wrapper:hover,
  .ant-input-search .ant-input:hover:not(:disabled) {
    border-color: var(--ui-border-accented);
  }

  .ant-input-affix-wrapper-focused,
  .ant-input-search .ant-input:focus,
  .ant-input-search .ant-input-focused {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  .ant-input::placeholder {
    color: var(--ui-text-dimmed);
  }

  .ant-input-search-icon,
  .ant-input-clear-icon {
    color: var(--ui-text-dimmed);
  }

  .ant-input-clear-icon:hover {
    color: var(--ui-text);
  }
`
