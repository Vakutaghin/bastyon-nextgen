import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Card = styled.div`
  .ant-card {
    background: ${COLORS.BG_PRIMARY} !important;
    border-color: ${COLORS.BORDER_LIGHT} !important;
    border-radius: 12px;
    box-shadow: ${COLORS.SHADOW_SM};
  }

  .ant-card-head {
    border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
    background: transparent;
  }

  .ant-card-head-title {
    color: ${COLORS.TEXT_PRIMARY} !important;
    font-weight: 600;
  }

  .ant-card-extra {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  .ant-card-body {
    color: ${COLORS.TEXT_PRIMARY} !important;
    background: ${COLORS.BG_PRIMARY} !important;
  }

  .ant-card-body * {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  .ant-card-body p {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  .ant-card-body div {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  .ant-card:hover {
    box-shadow: ${COLORS.SHADOW_MD};
  }
`
