import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Input = styled.div`
  :deep(.ant-input) {
    background: ${COLORS.BG_PRIMARY};
    color: ${COLORS.TEXT_PRIMARY};
    border-color: ${COLORS.BORDER};
    border-radius: 6px;
  }

  :deep(.ant-input:hover:not(:disabled)) {
    border-color: ${COLORS.TEXT_MUTED};
  }

  :deep(.ant-input:focus),
  :deep(.ant-input-focused) {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
  }

  :deep(.ant-input::placeholder) {
    color: ${COLORS.TEXT_SECONDARY};
  }

  :deep(.ant-input:disabled) {
    background: ${COLORS.BG_SECONDARY};
    color: ${COLORS.TEXT_SECONDARY};
    cursor: not-allowed;
    opacity: 0.6;
  }
`
