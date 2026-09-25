import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'

const activeProps = { active: Boolean }

export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z_INDEX.MODAL};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-overlay-65);
`

export const SC_Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow: auto;
  padding: 16px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
`

export const SC_Stage = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  user-select: none;
  touch-action: none;
`

export const SC_StageInner = styled.div`
  position: relative;
  display: inline-block;
  line-height: 0;
`

export const SC_StageImg = styled('img', { cssFilter: String })`
  display: block;
  max-width: 100%;
  max-height: 56vh;
  filter: ${(p) => p.cssFilter || 'none'};
`

export const SC_CropBox = styled.div`
  position: absolute;
  border: 2px solid var(--color-white);
  box-shadow: 0 0 0 9999px var(--color-overlay-55);
  cursor: move;
  box-sizing: border-box;
`

export const SC_CropHandle = styled.div`
  position: absolute;
  right: -7px;
  bottom: -7px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-white);
  border: 1px solid var(--color-border-default);
  cursor: nwse-resize;
`

export const SC_Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

export const SC_ToolBtn = styled('button', activeProps)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid ${(p) => (p.active ? COLORS.PRIMARY : COLORS.BORDER_DEFAULT)};
  background: ${(p) => (p.active ? COLORS.PRIMARY_LIGHT : COLORS.BG_SECONDARY)};
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_PRIMARY)};
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_FilterChip = styled('button', activeProps)`
  padding: 4px 10px;
  border-radius: var(--ui-radius-md);
  border: 0;
  box-shadow: ${(p) => (p.active ? 'none' : 'inset 0 0 0 1px var(--ui-border-accented)')};
  background: ${(p) => (p.active ? 'var(--ui-primary)' : 'var(--ui-bg)')};
  color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  /* Как у Nuxt UI: сплошная — акцент на 75%, контурная — подложка. */
  &:hover {
    background: ${(p) => (p.active ? 'rgb(var(--ui-primary-rgb) / 75%)' : 'var(--ui-bg-elevated)')};
    color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  }
`

export const SC_Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_ActionBtn = styled('button', { primary: Boolean })`
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  border: 0;
  box-shadow: ${(p) => (p.primary ? 'none' : 'inset 0 0 0 1px var(--ui-border-accented)')};
  background: ${(p) => (p.primary ? 'var(--ui-primary)' : 'var(--ui-bg)')};
  color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  /* Как у Nuxt UI: сплошная — акцент на 75%, контурная — подложка. */
  &:hover {
    background: ${(p) =>
      p.primary ? 'rgb(var(--ui-primary-rgb) / 75%)' : 'var(--ui-bg-elevated)'};
    color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  }
`
