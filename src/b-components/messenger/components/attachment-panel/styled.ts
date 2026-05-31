import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_AttachmentRoot = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`

export const SC_AttachButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid ${COLORS.BORDER};
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  color: ${COLORS.BLUE_GRAY};

  &:hover {
    background: ${COLORS.BG_HOVER_BLUE};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const SC_Menu = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER};
  border-radius: 10px;
  box-shadow: ${COLORS.SHADOW_MD};
  padding: 6px;
  min-width: 160px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_MenuItem = styled.button`
  background: none;
  border: 0;
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${COLORS.TEXT_PRIMARY};

  &:hover:not(:disabled) {
    background: ${COLORS.BG_HOVER_BLUE};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

export const SC_HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`
