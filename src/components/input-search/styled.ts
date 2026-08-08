import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_InputSearch = styled.div`
  width: 45%;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    flex-shrink: 1;
  }

  /* Antd Input.Search не телепортится — вложенные селекторы работают напрямую.
     :deep() в vue3-styled-components не функционирует (см. .ant-card в
     src/style.css), поэтому поле раньше оставалось белым в тёмной теме.
     При allow-clear antd оборачивает input в .ant-input-affix-wrapper — именно
     он рисует фон и рамку, поэтому темим и обёртку, и сам .ant-input. */
  .ant-input-affix-wrapper,
  .ant-input-search .ant-input {
    background: ${COLORS.BG_PRIMARY};
    color: ${COLORS.TEXT_PRIMARY};
    border-color: ${COLORS.BORDER};
    border-radius: 24px;
  }

  .ant-input-affix-wrapper {
    padding-left: 15px;
  }

  /* Внутренний input внутри affix-wrapper прозрачный — фон несёт обёртка. */
  .ant-input-affix-wrapper > .ant-input {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ant-input-affix-wrapper:hover,
  .ant-input-search .ant-input:hover:not(:disabled) {
    border-color: ${COLORS.TEXT_MUTED};
  }

  .ant-input-affix-wrapper-focused,
  .ant-input-search .ant-input:focus,
  .ant-input-search .ant-input-focused {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
  }

  .ant-input::placeholder {
    color: ${COLORS.TEXT_SECONDARY};
  }

  .ant-input-search-icon {
    color: ${COLORS.TEXT_SECONDARY};
  }

  .ant-input-clear-icon {
    color: ${COLORS.TEXT_SECONDARY};
  }

  .ant-input-clear-icon:hover {
    color: ${COLORS.DANGER};
  }
`
