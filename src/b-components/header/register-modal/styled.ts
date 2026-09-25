import styled from 'vue3-styled-components'

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
    width: 100%;
    padding: 4px 11px;
    font-size: 14px;
    line-height: 1.5715;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--ui-radius-md);
    outline: none;
    transition: all 0.2s;

    &::placeholder {
      color: var(--color-text-secondary);
    }

    &:hover:not(:disabled) {
      border-color: var(--color-text-muted);
    }

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-light-20);
    }

    &:disabled {
      background: var(--color-bg-secondary);
      color: var(--color-text-secondary);
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
`

export const SC_FormHint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
`

export const SC_ErrorMessage = styled.div`
  margin-top: 16px;
  padding: 12px;
  background-color: var(--color-red-bg);
  border: 1px solid var(--color-red-border);
  border-radius: var(--ui-radius-sm);
  color: var(--color-red-dark);
  font-size: 16px;
`

export const SC_LinkToSignIn = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  color: var(--color-text-secondary);
`

export const SC_LinkButton = styled('a', { isDisabled: Boolean })`
  color: var(--color-ant-blue);
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
