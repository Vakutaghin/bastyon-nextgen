import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'

const activeProps = { active: Boolean }

export const SC_BottomNav = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${Z_INDEX.STICKY};
  display: flex;
  align-items: stretch;
  height: 56px;
  padding-bottom: var(--safe-bottom);
  background: ${COLORS.BG_PRIMARY};
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_NavItem = styled('button', activeProps)`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  position: relative;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 0;
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY)};
  transition: color ${TRANSITIONS.FAST};

  &:active {
    opacity: 0.7;
  }
`

export const SC_NavIcon = styled.span`
  font-size: 20px;
  line-height: 1;
  display: inline-flex;
`

export const SC_NavLabel = styled.span`
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
`

export const SC_NavBadge = styled.span`
  position: absolute;
  top: 2px;
  left: calc(50% + 6px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: ${COLORS.DANGER};
  color: ${COLORS.WHITE};
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
`
