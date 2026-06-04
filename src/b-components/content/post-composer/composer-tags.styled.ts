import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING, Z_INDEX } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_TagsField = styled.div`
  position: relative;
`

export const SC_TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${SPACING.XS};
  padding: ${SPACING.XS} ${SPACING.SM};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  background: ${COLORS.BG_INPUT};
`

export const SC_TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.XS};
  padding: 2px ${SPACING.SM};
  font-size: ${FONT_SIZE.SM};
  color: ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY_LIGHT};
  border-radius: ${BORDER_RADIUS.SM};
  white-space: nowrap;
`

export const SC_TagRemove = styled.button`
  display: inline-flex;
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.PRIMARY};
  cursor: pointer;
  font-size: ${FONT_SIZE.MD};
  line-height: 1;
`

export const SC_TagInput = styled.input`
  flex: 1;
  min-width: 80px;
  padding: ${SPACING.XS} 0;
  border: none;
  outline: none;
  background: none;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: ${FONT_SIZE.MD};

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
  }

  &:disabled {
    cursor: not-allowed;
  }
`

export const SC_Dropdown = styled.ul`
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: ${Z_INDEX.LOCAL_DROPDOWN_HIGH};
  margin: 0;
  padding: ${SPACING.XS};
  list-style: none;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  box-shadow: 0 6px 20px ${COLORS.OVERLAY_12};
  max-height: 240px;
  overflow-y: auto;
`

const itemProps = { active: Boolean }

export const SC_Suggestion = styled('li', itemProps)`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  border-radius: ${BORDER_RADIUS.SM};
  cursor: pointer;
  background: ${(props) => (props.active ? COLORS.BG_HOVER : 'transparent')};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`
