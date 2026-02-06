import styled from 'vue3-styled-components'

export const SC_InputSearch = styled.div`
  width: 45%;
  flex-shrink: 0;

  @media (max-width: 800px) {
    width: 100%;
    flex-shrink: 1;
  }

  :deep(.ant-input-search .ant-input) {
    background: rgb(255, 255, 255);
    color: rgb(33, 37, 41);
    border-color: rgb(206, 212, 218);
    border-radius: 24px;
    padding-left: 15px;
    padding-right: 37px;
  }

  :deep(.ant-input-search .ant-input:hover:not(:disabled)) {
    border-color: rgb(173, 181, 189);
  }

  :deep(.ant-input-search .ant-input:focus),
  :deep(.ant-input-search .ant-input-focused) {
    border-color: rgb(0, 123, 255);
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
  }

  :deep(.ant-input-search .ant-input::placeholder) {
    color: rgb(108, 117, 125);
  }

  :deep(.ant-input-search-icon) {
    color: rgb(108, 117, 125);
    right: 15px;
  }

  :deep(.ant-input-clear-icon) {
    color: rgb(108, 117, 125);
    right: 37px;
  }

  :deep(.ant-input-clear-icon:hover) {
    color: rgb(220, 53, 69);
  }
`
