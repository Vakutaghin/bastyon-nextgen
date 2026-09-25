import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

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
  color: var(--color-text-primary);
`

export const SC_FormLabelOptional = styled.span`
  color: var(--color-text-muted);
  font-weight: normal;
  margin-left: 4px;
`

export const SC_InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  > input {
    ${nuxtField}
  }
`

export const SC_FormHint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
`

/** Подсказка-ошибка вместо обычной: имя уже занято. */
export const SC_FormHintError = styled(SC_FormHint)`
  color: var(--ui-error-strong);
`

export const SC_ErrorMessage = styled.div`
  margin-top: 16px;
  padding: 12px;
  background-color: var(--color-red-bg);
  border: 1px solid var(--color-red-border);
  border-radius: var(--ui-radius-lg);
  color: var(--color-red-dark);
  font-size: 14px;
`

export const SC_LinkToSignIn = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_LinkButton = styled('a', { isDisabled: Boolean })`
  color: var(--ui-primary-text);
  font-weight: 500;
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
