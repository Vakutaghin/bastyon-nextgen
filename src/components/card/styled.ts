import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Card = styled.div`
  :deep(.ant-card) {
    background: ${COLORS.BG_PRIMARY} !important;
    border-color: ${COLORS.BORDER_LIGHT} !important;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  :deep(.ant-card-head) {
    border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
    background: transparent;
  }

  :deep(.ant-card-head-title) {
    color: ${COLORS.TEXT_PRIMARY} !important;
    font-weight: 600;
  }

  :deep(.ant-card-extra) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.ant-card-body) {
    color: ${COLORS.TEXT_PRIMARY} !important;
    background: ${COLORS.BG_PRIMARY} !important;
  }

  :deep(.ant-card-body *) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.ant-card-body p) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.ant-card-body div) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.ant-card:hover) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`
