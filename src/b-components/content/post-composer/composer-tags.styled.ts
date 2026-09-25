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
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  background: var(--color-bg-input);
`

export const SC_TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.XS};
  padding: 2px ${SPACING.SM};
  font-size: ${FONT_SIZE.SM};
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-radius: ${BORDER_RADIUS.SM};
  white-space: nowrap;
`

export const SC_TagRemove = styled.button`
  display: inline-flex;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
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
  color: var(--color-text-primary);
  font-size: ${FONT_SIZE.MD};

  &::placeholder {
    color: var(--color-text-muted);
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
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  box-shadow: 0 6px 20px var(--color-overlay-12);
  max-height: min(320px, 50vh);
  overflow-y: auto;
  /* Скролл выпадашки не уезжает в модалку: без этого колесо докручивало список
     до конца и продолжало листать саму модалку, унося подсказки с экрана. */
  overscroll-behavior: contain;
`

const itemProps = { active: Boolean }

export const SC_Suggestion = styled('li', itemProps)`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-primary);
  border-radius: ${BORDER_RADIUS.SM};
  cursor: pointer;
  background: ${(props) => (props.active ? COLORS.BG_HOVER : 'transparent')};

  &:hover {
    background: var(--color-bg-hover);
  }
`
