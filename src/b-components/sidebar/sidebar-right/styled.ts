import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_RightSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  max-height: calc(100vh - 70px);
  background: ${COLORS.BG_PRIMARY};
  border-left: 1px solid ${COLORS.BORDER_LIGHTER};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: 62px;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 10;

  @media (max-width: ${BREAKPOINTS.DESKTOP}) {
    display: none;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${COLORS.BORDER_LIGHT};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(173, 181, 189, 0.7);
  }
`
