import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_RegisterForm = styled.div`
  padding: 20px 0;
`

export const SC_FormItem = styled.div`
  margin-bottom: 20px;
`

export const SC_FormLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_FormLabelOptional = styled.span`
  color: ${COLORS.TEXT_MUTED};
  font-weight: normal;
  margin-left: 4px;
`

export const SC_InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  > input {
    width: 100%;
    padding: 4px 11px;
    font-size: 14px;
    line-height: 1.5715;
    color: ${COLORS.TEXT_PRIMARY};
    background: ${COLORS.BG_PRIMARY};
    border: 1px solid ${COLORS.BORDER};
    border-radius: 6px;
    outline: none;
    transition: all 0.2s;

    &::placeholder {
      color: ${COLORS.TEXT_SECONDARY};
    }

    &:hover:not(:disabled) {
      border-color: ${COLORS.TEXT_MUTED};
    }

    &:focus {
      border-color: ${COLORS.PRIMARY};
      box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
    }

    &:disabled {
      background: ${COLORS.BG_SECONDARY};
      color: ${COLORS.TEXT_SECONDARY};
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
`

export const SC_FormHint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  line-height: 1.5;
`

export const SC_ErrorMessage = styled.div`
  margin-top: 16px;
  padding: 12px;
  background-color: ${COLORS.RED_BG};
  border: 1px solid ${COLORS.RED_BORDER};
  border-radius: 4px;
  color: ${COLORS.RED_DARK};
  font-size: 16px;
`

export const SC_LinkToSignIn = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_LinkButton = styled('a', { isDisabled: Boolean })`
  color: ${COLORS.ANT_BLUE};
  cursor: ${(p) => (p.isDisabled ? 'not-allowed' : 'pointer')};
  text-decoration: none;
  opacity: ${(p) => (p.isDisabled ? 0.5 : 1)};
  pointer-events: ${(p) => (p.isDisabled ? 'none' : 'auto')};

  &:hover {
    text-decoration: underline;
  }
`

export const SC_FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`
