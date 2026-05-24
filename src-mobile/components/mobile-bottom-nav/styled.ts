import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_MobileBottomNav = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: ${COLORS.BG_PRIMARY};
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
  box-shadow: 0 -1px 8px rgba(0, 0, 0, 0.06);
  -webkit-user-select: none;
  user-select: none;
`

const itemAttrs = { active: Boolean }

export const SC_MobileBottomNavItem = styled('a', itemAttrs)`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-decoration: none;
  font-size: 11px;
  line-height: 1;
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_PRIMARY)};
  opacity: ${(p) => (p.active ? 1 : 0.72)};
  transition: color 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  & .anticon {
    font-size: 22px;
  }

  &:active {
    opacity: 1;
  }
`

export const SC_MobileBottomNavLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2px;
`
