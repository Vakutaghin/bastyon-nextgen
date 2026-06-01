import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: ${COLORS.OVERLAY_50};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
`

export const SC_Modal = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 14px;
  width: 100%;
  max-width: 420px;
  box-shadow: ${COLORS.SHADOW_LG};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid ${COLORS.BG_SECONDARY};
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: ${COLORS.DARK_BG};
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
  color: ${COLORS.BLUE_GRAY};
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_Input = styled.input`
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: ${COLORS.DARK_BG};
  background: ${COLORS.BG_PRIMARY};
  outline: none;

  &:focus {
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_Textarea = styled.textarea`
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: ${COLORS.DARK_BG};
  background: ${COLORS.BG_PRIMARY};
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;

  &:focus {
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_Recipient = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_DARK};
  word-break: break-all;
  background: ${COLORS.BG_HOVER_BLUE};
  padding: 8px 10px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`

export const SC_Error = styled.div`
  color: ${COLORS.RED_DARK};
  font-size: 12px;
`

export const SC_Footer = styled.div`
  padding: 12px 20px;
  border-top: 1px solid ${COLORS.BG_SECONDARY};
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Button = styled('button', { primary: Boolean })`
  border: 0;
  padding: 9px 16px;
  border-radius: 8px;
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
