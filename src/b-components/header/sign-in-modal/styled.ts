import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
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
  color: ${COLORS.TEXT_PRIMARY};
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

export const SC_PasswordToggle = styled.span`
  position: absolute;
  right: 8px;
  cursor: pointer;
  user-select: none;
  padding: 4px 8px;
  font-size: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
  z-index: 1;
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  align-items: center;
  height: 100%;

  &:hover {
    opacity: 1;
  }
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

export const SC_LinkToRegister = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_LinkButton = styled.a`
  color: ${COLORS.ANT_BLUE};
  cursor: pointer;
  text-decoration: none;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
`
