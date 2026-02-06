import styled from 'vue3-styled-components'

export const SC_Card = styled.div`
  :deep(.ant-card) {
    background: rgb(255, 255, 255) !important;
    border-color: rgba(206, 212, 218, 0.5) !important;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  :deep(.ant-card-head) {
    border-bottom: 1px solid rgba(206, 212, 218, 0.5);
    background: transparent;
  }

  :deep(.ant-card-head-title) {
    color: rgb(33, 37, 41) !important;
    font-weight: 600;
  }

  :deep(.ant-card-extra) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.ant-card-body) {
    color: rgb(33, 37, 41) !important;
    background: rgb(255, 255, 255) !important;
  }

  :deep(.ant-card-body *) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.ant-card-body p) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.ant-card-body div) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.ant-card:hover) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`
