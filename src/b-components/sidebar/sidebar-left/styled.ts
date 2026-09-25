import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_LeftSidebar = styled.aside`
  width: 280px;
  min-width: 280px;
  max-height: calc(100vh - var(--header-height-total) - 8px);
  background: var(--ui-bg);
  border-right: 1px solid var(--ui-border);
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
  transition:
    width 0.2s ease,
    min-width 0.2s ease,
    padding 0.2s ease;

  &.collapsed {
    width: 64px;
    min-width: 64px;
    padding: 12px 8px;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
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
    border-radius: var(--ui-radius-xs);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--ui-text-dimmed);
  }
`
