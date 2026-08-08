import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ShareMenu = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 6px;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 10px;
  box-shadow: ${COLORS.SHADOW_MD};
`

export const SC_ShareItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }

  &.share-item--danger {
    color: ${COLORS.DANGER};
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_ShareIcon = styled('span', { color: String })`
  display: inline-flex;
  width: 18px;
  justify-content: center;
  color: ${(p) => p.color || 'currentColor'};
`

export const SC_ShareDivider = styled.div`
  height: 1px;
  margin: 4px 6px;
  background: ${COLORS.BORDER_LIGHTER};
`
