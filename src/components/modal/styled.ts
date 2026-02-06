import styled from 'vue3-styled-components'

export const SC_Modal = styled.div`
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
  }

  :deep(.ant-modal-footer) {
    border-top: 1px solid rgba(206, 212, 218, 0.5);
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
