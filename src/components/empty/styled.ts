import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Empty = styled.div`
  :deep(.ant-empty-description) {
    color: ${COLORS.TEXT_SECONDARY};
  }

  :deep(.ant-empty-image) {
    opacity: 0.5;
  }
`
