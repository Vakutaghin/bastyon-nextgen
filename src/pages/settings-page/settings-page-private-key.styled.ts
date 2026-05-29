import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_PrivateKeySection = styled.div`
  max-width: 560px;
`

export const SC_PrivateKeyWarning = styled.div`
  padding: 12px 16px;
  background-color: ${COLORS.WARNING_BG};
  border: 1px solid ${COLORS.WARNING_BORDER};
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.WARNING_TEXT};
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: ${COLORS.BG_TERTIARY};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 8px;
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 16px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 13px;
  color: ${COLORS.OVERLAY_45};
  margin-bottom: 8px;
  font-weight: 600;
`

export const SC_PrivateKeyValue = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: ${COLORS.BLACK};
  word-break: break-all;
  user-select: all;
`

export const SC_CopyIconBtn = styled.button`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 6px;
  background: ${COLORS.WHITE};
  color: ${COLORS.OVERLAY_65};
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST},
    background ${TRANSITIONS.FAST};

  &:hover {
    color: ${COLORS.ANT_BLUE};
    border-color: ${COLORS.ANT_BLUE};
    background: ${COLORS.ANT_BLUE_BG};
  }
`

export const SC_ShowKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.WHITE};
  background: ${COLORS.ANT_BLUE};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.ANT_BLUE_HOVER};
  }

  &:disabled {
    background: ${COLORS.BORDER_DEFAULT};
    cursor: not-allowed;
  }
`

export const SC_HideKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.OVERLAY_65};
  background: transparent;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 6px;
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    color: ${COLORS.ANT_BLUE};
    border-color: ${COLORS.ANT_BLUE};
  }
`

export const SC_ConfirmOverlay = styled.div`
  padding: 20px;
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.WARNING_BORDER_LIGHT};
  border-radius: 8px;
  max-width: 480px;
`

export const SC_ConfirmTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.ORANGE_TEXT};
  margin-bottom: 12px;
`

export const SC_ConfirmText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: ${COLORS.GRAY_212};
  margin: 0 0 16px;
`

export const SC_ConfirmButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const SC_ConfirmBtnPrimary = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.WHITE};
  background: ${COLORS.ANT_BLUE};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.ANT_BLUE_HOVER};
  }
`

export const SC_ConfirmBtnDefault = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.OVERLAY_65};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 6px;
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    color: ${COLORS.ANT_BLUE};
    border-color: ${COLORS.ANT_BLUE};
  }
`
