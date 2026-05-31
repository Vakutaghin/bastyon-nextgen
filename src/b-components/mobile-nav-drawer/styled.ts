import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const overlayProps = { isOpen: Boolean }

export const SC_Backdrop = styled('div', overlayProps)`
  position: fixed;
  inset: 0;
  background: ${COLORS.OVERLAY_45};
  z-index: 1100;
  opacity: ${(p) => (p.isOpen ? 1 : 0)};
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')};
  transition: opacity 0.22s ease;
  -webkit-tap-highlight-color: transparent;
`

export const SC_Drawer = styled('aside', overlayProps)`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(320px, 86vw);
  background: ${COLORS.BG_PRIMARY};
  z-index: 1101;
  display: flex;
  flex-direction: column;
  box-shadow: ${COLORS.SHADOW_LG};
  transform: translateX(${(p) => (p.isOpen ? '0' : '-100%')});
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  -webkit-tap-highlight-color: transparent;
  overflow-y: auto;
`

export const SC_DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_DrawerTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_DrawerClose = styled.button`
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: ${COLORS.TEXT_PRIMARY};
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: ${COLORS.OVERLAY_6};
  }
`

export const SC_DrawerSection = styled.div`
  padding: 8px;
`

export const SC_DrawerSectionTitle = styled.div`
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${COLORS.TEXT_HINT};
`

const itemProps = { active: Boolean }

export const SC_DrawerItem = styled('button', itemProps)`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  border: none;
  background: ${(p) => (p.active ? COLORS.PRIMARY_BG_SOFT : 'transparent')};
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_PRIMARY)};
  font-size: 15px;
  font-weight: ${(p) => (p.active ? 600 : 500)};
  text-align: left;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;

  & .anticon {
    font-size: 20px;
    flex-shrink: 0;
  }

  &:active {
    background: ${COLORS.OVERLAY_5};
  }
`
