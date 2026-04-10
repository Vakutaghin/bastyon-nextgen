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
  color: rgba(0, 0, 0, 0.85);
`

export const SC_FormLabelOptional = styled.span`
  color: rgba(0, 0, 0, 0.45);
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
    background: #fff;
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
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.5;
`

export const SC_ErrorMessage = styled.div`
  margin-top: 16px;
  padding: 12px;
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  color: #cf1322;
  font-size: 16px;
`

export const SC_LinkToSignIn = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.65);
`

export const SC_LinkButton = styled.a`
  color: #1890ff;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
