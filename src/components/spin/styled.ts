import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Spin = styled.div`
  :deep(.ant-spin-dot-item) {
    background-color: ${COLORS.PRIMARY};
  }

  :deep(.ant-spin-text) {
    color: ${COLORS.TEXT_PRIMARY};
  }
`
