import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BORDER_RADIUS, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'

export const SC_Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z_INDEX.MODAL};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: ${COLORS.OVERLAY_65};
`

export const SC_Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 440px;
  padding: 18px;
  border-radius: ${BORDER_RADIUS.LG};
  background: ${COLORS.BG_PRIMARY};
`

export const SC_Title = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
`

export const SC_Label = styled.span`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_Input = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: ${BORDER_RADIUS.MD};
  background: ${COLORS.BG_INPUT};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
  }
`

export const SC_Hint = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_Error = styled.div`
  font-size: 13px;
  color: ${COLORS.DANGER};
  word-break: break-word;
`

export const SC_Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Btn = styled('button', { primary: Boolean })`
  padding: 8px 16px;
  border-radius: ${BORDER_RADIUS.MD};
  border: 1px solid ${(p) => (p.primary ? COLORS.PRIMARY : COLORS.BORDER_DEFAULT)};
  background: ${(p) => (p.primary ? COLORS.PRIMARY : 'none')};
  color: ${(p) => (p.primary ? COLORS.WHITE : COLORS.TEXT_PRIMARY)};
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
