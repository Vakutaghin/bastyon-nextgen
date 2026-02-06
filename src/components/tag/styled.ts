import styled from 'vue3-styled-components'

export const SC_Tag = styled.div`
  :deep(.ant-tag) {
    background: rgba(0, 123, 255, 0.1);
    color: rgb(0, 123, 255);
    border-color: rgba(0, 123, 255, 0.3);
    border-radius: 12px;
    padding: 4px 7px;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  :deep(.ant-tag:hover) {
    background: rgba(0, 123, 255, 0.2);
    border-color: rgba(0, 123, 255, 0.5);
  }

  :deep(.ant-tag-checkable:hover:not(.ant-tag-checkable-checked)) {
    background: rgba(0, 123, 255, 0.15);
  }

  :deep(.ant-tag-checkable-checked) {
    background: rgb(0, 123, 255);
    color: rgb(255, 255, 255);
    border-color: rgb(0, 123, 255);
  }
`
