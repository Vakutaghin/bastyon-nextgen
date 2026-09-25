import styled from 'vue3-styled-components'

const overlayProps = { isOpen: Boolean }

export const SC_Backdrop = styled('div', overlayProps)`
  position: fixed;
  inset: 0;
  /* Как оверлей Nuxt UI: светлая дымка bg-elevated/75, не чёрное затемнение. */
  background: rgb(var(--ui-bg-elevated-rgb) / 75%);
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
  background: var(--ui-bg);
  z-index: 1101;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
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
  border-bottom: 1px solid var(--ui-border);
`

export const SC_DrawerTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_DrawerClose = styled.button`
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  color: var(--ui-text);
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: var(--ui-bg-elevated);
  }
`

export const SC_DrawerSection = styled.div`
  padding: 8px;
`

export const SC_DrawerSectionTitle = styled.div`
  padding: 8px 12px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

const itemProps = { active: Boolean }

export const SC_DrawerItem = styled('button', itemProps)`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: none;
  background: ${(p) => (p.active ? 'var(--ui-bg-elevated)' : 'transparent')};
  color: ${(p) => (p.active ? 'var(--ui-primary)' : 'var(--ui-text)')};
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;

  & .anticon {
    font-size: 20px;
    flex-shrink: 0;
  }

  &:active {
    background: var(--ui-bg-elevated);
  }
`
