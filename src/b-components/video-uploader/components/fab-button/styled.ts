import styled from 'vue3-styled-components'

export const SC_FabButton = styled.button`
  position: fixed !important;
  bottom: 24px !important;
  left: 24px !important;
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background-color: #1890ff !important;
  color: white !important;
  border: none !important;
  cursor: pointer !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 99999 !important;
  pointer-events: auto !important;
  transition: all 0.3s ease !important;

  &:hover {
    background-color: #40a9ff !important;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
    transform: scale(1.05) !important;
  }

  &:active {
    transform: scale(0.95) !important;
  }
`
