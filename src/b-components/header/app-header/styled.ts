import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--header-height-total);
  padding-top: var(--safe-top);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  background: ${COLORS.BG_PRIMARY};
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
`

export const SC_Sections = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 var(--content-padding-x);
  max-width: var(--content-max-width);
  margin: 0 auto;
  gap: 12px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    gap: 8px;
  }
`

export const SC_MessengerWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 6px;
  }
`

export const SC_UnreadBadge = styled.span`
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgb(220, 53, 69);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
  box-shadow: 0 0 0 2px ${COLORS.BG_PRIMARY};
`

export const SC_HamburgerButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-right: 4px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: ${COLORS.TEXT_PRIMARY};
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;

  & .anticon {
    font-size: 22px;
  }

  &:active {
    background: rgba(0, 0, 0, 0.06);
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: inline-flex;
  }
`

export const SC_Right = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  flex: 0 0 auto;
  gap: 10px;
  margin-left: 12px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    gap: 6px;
    margin-left: 8px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    gap: 4px;
    margin-left: 4px;
  }
`
