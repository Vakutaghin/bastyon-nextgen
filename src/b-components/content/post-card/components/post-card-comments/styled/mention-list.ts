import styled from 'vue3-styled-components'

export const SC_MentionList = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-ddd);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 10;
`

export const SC_MentionItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-hover);
  }

  &.mention-item--highlighted {
    background: var(--color-ant-blue-bg-light);
  }
`
