import styled from 'vue3-styled-components'
import { Alert } from 'ant-design-vue'
import Input from '@/components/input/input.vue'

export const SC_SignInForm = styled.div`
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

export const SC_InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`

export const SC_InputWithToggle = styled(Input)`
  flex: 1;
  padding-right: 40px;
`

export const SC_PasswordToggle = styled('span', { isDisabled: Boolean })`
  position: absolute;
  right: 8px;
  cursor: ${(p) => (p.isDisabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  padding: 4px 8px;
  font-size: 16px;
  opacity: ${(p) => (p.isDisabled ? 0.35 : 0.6)};
  pointer-events: ${(p) => (p.isDisabled ? 'none' : 'auto')};
  transition: opacity 0.2s;
  z-index: 1;
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
  height: 100%;

  &:hover {
    opacity: ${(p) => (p.isDisabled ? 0.35 : 1)};
  }
`

export const SC_InfoAlert = styled(Alert)`
  margin-top: 8px;
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

export const SC_QrToggleRow = styled.div`
  margin-top: 10px;
  display: flex;
  justify-content: flex-start;
`

export const SC_LinkToRegister = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  color: var(--color-text-secondary);
`

export const SC_LinkButton = styled('a', { isDisabled: Boolean })`
  color: var(--color-ant-blue);
  cursor: ${(p) => (p.isDisabled ? 'not-allowed' : 'pointer')};
  text-decoration: none;
  margin-left: 4px;
  opacity: ${(p) => (p.isDisabled ? 0.5 : 1)};
  pointer-events: ${(p) => (p.isDisabled ? 'none' : 'auto')};

  &:hover {
    text-decoration: underline;
  }
`
