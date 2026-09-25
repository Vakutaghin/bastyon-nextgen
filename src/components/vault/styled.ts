import styled from 'vue3-styled-components'

export const SC_VaultBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_VaultPrompt = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_VaultError = styled.div`
  font-size: 14px;
  color: var(--color-danger);
`

export const SC_VaultForgot = styled.button`
  margin-top: 6px;
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-size: 14px;
  color: var(--color-link);
  cursor: pointer;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`
