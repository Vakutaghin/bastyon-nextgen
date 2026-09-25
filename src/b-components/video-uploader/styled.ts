import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

// Кастомный overlay для Tauri/webview — не зависит от Ant Design Modal
export const SC_ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-45);
  padding: 24px;
  box-sizing: border-box;
`

export const SC_ModalBox = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: ${COLORS.SHADOW_LG};
  width: 95vw;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
`

export const SC_ModalHeader = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: var(--color-bg-primary);
`

export const SC_ModalTitle = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_ModalClose = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1;

  &:hover {
    color: var(--color-text-primary);
  }
`

export const SC_ModalBody = styled.div`
  padding: 24px;
  overflow: auto;
  flex: 1;
  min-height: 0;
`

// Контент модалки
export const SC_ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 60vh;
  max-height: 85vh;
`
