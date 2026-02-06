import styled from 'vue3-styled-components'

export const SC_PostModalWrapper = styled.div`
  :deep(.ant-modal-content) {
    background: rgb(255, 255, 255);
    border-radius: 12px;
  }

  :deep(.ant-modal-header) {
    background: rgb(255, 255, 255);
    border-bottom: 1px solid rgba(206, 212, 218, 0.5);
    padding: 20px 24px;
  }

  :deep(.ant-modal-title) {
    color: rgb(33, 37, 41);
    font-size: 20px;
    font-weight: 600;
  }

  :deep(.ant-modal-close) {
    color: rgb(33, 37, 41);
  }

  :deep(.ant-modal-close:hover) {
    color: rgb(33, 37, 41);
    background: rgba(248, 249, 250, 0.8);
  }

  :deep(.ant-modal-body) {
    color: rgb(33, 37, 41);
    padding: 24px;
    background: rgb(255, 255, 255);
  }

  :deep(.ant-modal-footer) {
    border-top: 1px solid rgba(206, 212, 218, 0.5);
    padding: 16px 24px;
  }
`

export const SC_PostModalContent = styled.div`
  padding: 0;
`
