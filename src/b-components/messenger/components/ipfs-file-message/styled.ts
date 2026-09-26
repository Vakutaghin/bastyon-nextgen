import styled from 'vue3-styled-components'

// Каркас карточки — общий с обычным файлом (../file-message/styled.ts); здесь
// только то, чего у того нет: действия под именем.

export const SC_IpfsActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`

export const SC_IpfsAction = styled.button`
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-md);
  background: var(--color-bg-primary);
  font: inherit;
  font-size: 12px;
  color: var(--ui-primary);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-bg-hover-blue);
  }

  &:disabled {
    color: var(--ui-text-muted);
    cursor: default;
  }
`
