import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_PostModalWrapper = styled.div`
  :deep(.ant-modal-content) {
    background: ${COLORS.BG_PRIMARY};
    border-radius: 12px;
  }

  :deep(.ant-modal-header) {
    background: ${COLORS.BG_PRIMARY};
    border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
    padding: 20px 24px;
  }

  :deep(.ant-modal-title) {
    color: ${COLORS.TEXT_PRIMARY};
    font-size: 20px;
    font-weight: 600;
  }

  :deep(.ant-modal-close) {
    color: ${COLORS.TEXT_PRIMARY};
  }

  :deep(.ant-modal-close:hover) {
    color: ${COLORS.TEXT_PRIMARY};
    background: ${COLORS.SURFACE_FROSTED};
  }

  :deep(.ant-modal-body) {
    color: ${COLORS.TEXT_PRIMARY};
    padding: 24px;
    background: ${COLORS.BG_PRIMARY};
  }

  :deep(.ant-modal-footer) {
    border-top: 1px solid ${COLORS.BORDER_LIGHT};
    padding: 16px 24px;
  }
`

export const SC_PostModalContent = styled.div`
  padding: 0;
`
