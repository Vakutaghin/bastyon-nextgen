import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BORDER_RADIUS, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'

const activeProps = { active: Boolean }

export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z_INDEX.MODAL};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: ${COLORS.OVERLAY_65};
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
  border-radius: ${BORDER_RADIUS.LG};
  background: ${COLORS.BG_PRIMARY};
`

export const SC_Stage = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${COLORS.BG_SECONDARY};
  border-radius: ${BORDER_RADIUS.MD};
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
  border: 2px solid ${COLORS.WHITE};
  box-shadow: 0 0 0 9999px ${COLORS.OVERLAY_55};
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
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
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
  border-radius: ${BORDER_RADIUS.MD};
  border: 1px solid ${(p) => (p.active ? COLORS.PRIMARY : COLORS.BORDER_DEFAULT)};
  background: ${(p) => (p.active ? COLORS.PRIMARY_LIGHT : COLORS.BG_SECONDARY)};
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_PRIMARY)};
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_FilterChip = styled('button', activeProps)`
  padding: 5px 11px;
  border-radius: 14px;
  border: 1px solid ${(p) => (p.active ? COLORS.PRIMARY : COLORS.BORDER_DEFAULT)};
  background: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.BG_SECONDARY)};
  color: ${(p) => (p.active ? COLORS.WHITE : COLORS.TEXT_SECONDARY)};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};
`

export const SC_Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_ActionBtn = styled('button', { primary: Boolean })`
  padding: 8px 18px;
  border-radius: ${BORDER_RADIUS.MD};
  border: 1px solid ${(p) => (p.primary ? COLORS.PRIMARY : COLORS.BORDER_DEFAULT)};
  background: ${(p) => (p.primary ? COLORS.PRIMARY : 'none')};
  color: ${(p) => (p.primary ? COLORS.WHITE : COLORS.TEXT_PRIMARY)};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};
`
