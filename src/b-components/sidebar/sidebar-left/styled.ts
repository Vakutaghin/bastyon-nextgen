import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_LeftSidebar = styled.aside`
  width: 280px;
  min-width: 280px;
  /* Во всю высоту окна: строка версии стоит внизу, а не сразу под тегами. */
  height: calc(100vh - var(--header-height-total) - 8px);
  background: var(--ui-bg);
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: calc(var(--header-height-total) + 2px);
  z-index: 10;
  transition:
    width var(--transition-fast),
    min-width var(--transition-fast);

  &.collapsed {
    width: 64px;
    min-width: 64px;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_LeftSidebarScroll = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  transition: padding var(--transition-fast);

  &.collapsed {
    padding: 12px 8px;
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

/** Номер версии — вровень с иконками пунктов панели (у них отступ 10px). */
export const SC_LeftSidebarFooter = styled.div`
  flex-shrink: 0;
  padding: 6px 12px 6px 26px;
  border-top: 1px solid var(--ui-border);

  &.collapsed {
    padding: 6px 8px;
  }
`
