import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_RightSidebar = styled.aside`
  width: 280px;
  min-width: 280px;
  max-height: calc(100vh - var(--header-height-total) - 8px);
  background: var(--ui-bg);
  border-left: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: calc(var(--header-height-total) + 2px);
  padding: 16px;
  overflow-y: auto;
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
    background: var(--ui-border-accented);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--ui-text-dimmed);
  }
`
