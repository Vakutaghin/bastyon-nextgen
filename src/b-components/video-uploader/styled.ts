import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

// Кастомный overlay для Tauri/webview — не зависит от Ant Design Modal
export const SC_ModalOverlay = styled.div`
  position: fixed !important;
  inset: 0 !important;
  z-index: 10001 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: ${COLORS.OVERLAY_45} !important;
  padding: 24px !important;
  box-sizing: border-box !important;
`

export const SC_ModalBox = styled.div`
  background: ${COLORS.BG_PRIMARY} !important;
  border-radius: 8px !important;
  box-shadow: ${COLORS.SHADOW_LG} !important;
  width: 95vw !important;
  max-width: 1200px !important;
  max-height: 90vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
`

export const SC_ModalHeader = styled.div`
  padding: 16px 24px !important;
  border-bottom: 1px solid ${COLORS.BG_HOVER} !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-shrink: 0 !important;
  background: ${COLORS.BG_PRIMARY} !important;
`

export const SC_ModalTitle = styled.span`
  font-size: 16px !important;
  font-weight: 600 !important;
  color: ${COLORS.TEXT_PRIMARY} !important;
`

export const SC_ModalClose = styled.button`
  background: none !important;
  border: none !important;
  padding: 4px !important;
  cursor: pointer !important;
  color: ${COLORS.TEXT_SECONDARY} !important;
  font-size: 16px !important;
  line-height: 1 !important;

  &:hover {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }
`

export const SC_ModalBody = styled.div`
  padding: 24px !important;
  overflow: auto !important;
  flex: 1 !important;
  min-height: 0 !important;
`

// Контент модалки
export const SC_ModalContent = styled.div`
  display: flex !important;
  flex-direction: column !important;
  gap: 24px !important;
  min-height: 60vh !important;
  max-height: 85vh !important;
`
