import styled from 'vue3-styled-components'

export const SC_InfoContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-bg-hover);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_InfoLabel = styled.div`
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: 16px;
`

export const SC_InfoValue = styled.div`
  color: var(--color-text-primary);
  font-size: 16px;
  text-align: right;
  word-break: break-word;
  max-width: 60%;
`
