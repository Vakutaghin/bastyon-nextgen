import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Modal = styled.div`
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
    background: rgba(248, 249, 250, 0.8);
  }

  :deep(.ant-modal-body) {
    color: ${COLORS.TEXT_PRIMARY};
    padding: 24px;
  }

  :deep(.ant-modal-footer) {
    border-top: 1px solid ${COLORS.BORDER_LIGHT};
    padding: 16px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Если в footer только одна кнопка или контент, выравниваем вправо */
  :deep(.ant-modal-footer > *:not(:last-child)) {
    margin-right: 0;
  }

  /* Стили для маски модального окна */
  :deep(.bastyon-modal-wrap .ant-modal-mask) {
    background-color: rgba(0, 0, 0, 0.45) !important;
    backdrop-filter: blur(4px);
  }
`
