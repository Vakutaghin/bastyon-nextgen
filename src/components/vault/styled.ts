import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_VaultBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_VaultPrompt = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_VaultError = styled.div`
  font-size: 13px;
  color: ${COLORS.DANGER};
`

export const SC_VaultForgot = styled.button`
  margin-top: 6px;
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  color: ${COLORS.LINK};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
