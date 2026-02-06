import styled from 'vue3-styled-components'

export const SC_Input = styled.div`
  :deep(.ant-input) {
    background: rgb(255, 255, 255);
    color: rgb(33, 37, 41);
    border-color: rgb(206, 212, 218);
    border-radius: 6px;
  }

  :deep(.ant-input:hover:not(:disabled)) {
    border-color: rgb(173, 181, 189);
  }

  :deep(.ant-input:focus),
  :deep(.ant-input-focused) {
    border-color: rgb(0, 123, 255);
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
  }

  :deep(.ant-input::placeholder) {
    color: rgb(108, 117, 125);
  }

  :deep(.ant-input:disabled) {
    background: rgb(248, 249, 250);
    color: rgb(108, 117, 125);
    cursor: not-allowed;
    opacity: 0.6;
  }
`
