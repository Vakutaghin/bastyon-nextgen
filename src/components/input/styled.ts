import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

// Antd Input НЕ телепортится — он живёт внутри этой обёртки, поэтому вложенный
// селектор .ant-input работает напрямую. :deep() в vue3-styled-components не
// функционирует (см. коммент у .ant-card в src/style.css), из-за чего эти стили
// раньше не применялись и поле оставалось белым в тёмной теме.
//
// При allow-clear / prefix / suffix antd оборачивает input в
// .ant-input-affix-wrapper — именно он рисует фон и рамку (внутренний .ant-input
// становится прозрачным), поэтому темим и обёртку тоже.
export const SC_Input = styled.div`
  .ant-input,
  .ant-input-affix-wrapper {
    background: ${COLORS.BG_PRIMARY};
    color: ${COLORS.TEXT_PRIMARY};
    border-color: ${COLORS.BORDER};
    border-radius: 6px;
  }

  .ant-input-affix-wrapper > .ant-input {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ant-input:hover:not(:disabled),
  .ant-input-affix-wrapper:hover {
    border-color: ${COLORS.TEXT_MUTED};
  }

  .ant-input:focus,
  .ant-input-focused,
  .ant-input-affix-wrapper-focused {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
  }

  .ant-input::placeholder {
    color: ${COLORS.TEXT_SECONDARY};
  }

  /* Иконка очистки (allow-clear) — видимый цвет в тёмной теме. */
  .ant-input-clear-icon {
    color: ${COLORS.TEXT_SECONDARY};
  }

  .ant-input-clear-icon:hover {
    color: ${COLORS.TEXT_MUTED};
  }

  .ant-input:disabled,
  .ant-input-affix-wrapper-disabled {
    background: ${COLORS.BG_SECONDARY};
    color: ${COLORS.TEXT_SECONDARY};
    cursor: not-allowed;
    opacity: 0.6;
  }
`
