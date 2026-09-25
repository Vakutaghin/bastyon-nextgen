import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { nuxtField } from '@/styles/field-styles'

export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: var(--color-overlay-50);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
`

export const SC_Modal = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  width: 100%;
  max-width: 420px;
  box-shadow: ${COLORS.SHADOW_LG};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-bg-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-dark-bg);
`

export const SC_Body = styled.div`
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-blue-gray);
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_Input = styled.input`
  ${nuxtField}
`

export const SC_Textarea = styled.textarea`
  ${nuxtField}
  resize: vertical;
  min-height: 60px;
`

export const SC_Recipient = styled.div`
  font-size: 13px;
  color: var(--color-text-dark);
  word-break: break-all;
  background: var(--color-bg-hover-blue);
  padding: 8px 10px;
  border-radius: var(--ui-radius-md);
  font-family: var(--font-family-mono);
`

export const SC_Error = styled.div`
  color: var(--color-red-dark);
  font-size: 12px;
`

export const SC_Footer = styled.div`
  padding: 12px 20px;
  border-top: 1px solid var(--color-bg-secondary);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Button = styled('button', { primary: Boolean })`
  border: 0;
  padding: 9px 16px;
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: ${(p) => (p.primary ? COLORS.BRAND_CYAN : COLORS.BG_SECONDARY)};
  color: ${(p) => (p.primary ? COLORS.WHITE : COLORS.TEXT_PRIMARY)};

  &:hover:not(:disabled) {
    background: ${(p) => (p.primary ? COLORS.BRAND_CYAN_HOVER : COLORS.GRAY_E0)};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`
