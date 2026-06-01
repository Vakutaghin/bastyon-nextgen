import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const props = {
  isOpen: Boolean,
}

export const SC_Window = styled('div', props)`
  width: 360px;
  height: 500px;
  background-color: ${COLORS.BG_PRIMARY};
  border-radius: 12px;
  box-shadow: ${COLORS.SHADOW_LG};
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  overflow: hidden;
  transform-origin: bottom right;
  transition:
    opacity 0.2s,
    transform 0.2s;
  opacity: ${(props) => (props.isOpen ? '1' : '0')};
  transform: ${(props) => (props.isOpen ? 'scale(1)' : 'scale(0.9)')};
  pointer-events: ${(props) => (props.isOpen ? 'auto' : 'none')};
`

export const SC_Header = styled.div`
  height: 56px;
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
  gap: 12px;
`

export const SC_Title = styled.div`
  flex: 1;
`

export const SC_Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: ${COLORS.BG_PRIMARY};
`

export const SC_CloseButton = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  background: transparent;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 8px;
`
