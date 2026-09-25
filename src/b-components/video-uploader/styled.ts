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
  background: var(--color-overlay-45) !important;
  padding: 24px !important;
  box-sizing: border-box !important;
`

export const SC_ModalBox = styled.div`
  background: var(--color-bg-primary) !important;
  border-radius: var(--ui-radius-lg) !important;
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
  border-bottom: 1px solid var(--color-bg-hover) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-shrink: 0 !important;
  background: var(--color-bg-primary) !important;
`

export const SC_ModalTitle = styled.span`
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
`

export const SC_ModalClose = styled.button`
  background: none !important;
  border: none !important;
  padding: 4px !important;
  cursor: pointer !important;
  color: var(--color-text-secondary) !important;
  font-size: 16px !important;
  line-height: 1 !important;

  &:hover {
    color: var(--color-text-primary) !important;
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
