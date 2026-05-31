import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_FabButton = styled.button`
  position: fixed !important;
  bottom: 24px !important;
  left: 24px !important;
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background-color: ${COLORS.ANT_BLUE} !important;
  color: ${COLORS.WHITE} !important;
  border: none !important;
  cursor: pointer !important;
  box-shadow: ${COLORS.SHADOW_MD} !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 99999 !important;
  pointer-events: auto !important;
  transition: all 0.3s ease !important;

  &:hover {
    background-color: ${COLORS.ANT_BLUE_HOVER} !important;
    box-shadow: ${COLORS.SHADOW_LG} !important;
    transform: scale(1.05) !important;
  }

  &:active {
    transform: scale(0.95) !important;
  }
`
