import styled from 'vue3-styled-components'

export const SC_ErrorMessage = styled.div`
  margin-top: 1em;
  padding: 0.75em;
  background: rgb(255, 240, 240);
  border: 1px solid rgb(255, 200, 200);
  border-radius: 4px;
  color: rgb(200, 0, 0);
  font-size: 0.9em;
`

export const SC_CaptchaModalWrapper = styled.div`
  /* Стили для модального окна применяются через wrapClassName */
  
  :deep(.captcha-modal-wrap) {
    .ant-modal {
      max-width: 450px;
    }

    .ant-modal-body {
      padding: 1.5em;
    }
  }
`
