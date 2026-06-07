import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_MentionAnchor = styled.div`
  position: relative;
  width: 100%;
`

export const SC_MentionDropdown = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: ${Z_INDEX.DROPDOWN};
  margin: 4px 0 0;
  padding: 4px;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: ${BORDER_RADIUS.MD};
  box-shadow: 0 6px 24px ${COLORS.OVERLAY_20};
`

export const SC_MentionRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: ${BORDER_RADIUS.SM};
  cursor: pointer;

  &.active,
  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_MentionAvatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 13px;
  font-weight: 600;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_MentionName = styled.span`
  min-width: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.MD};
  width: 100%;
`

export const SC_EmojiRow = styled.div`
  display: flex;
  margin-top: -4px;
`

export const SC_EmojiBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: ${BORDER_RADIUS.SM};
  background: none;
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 18px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
    color: ${COLORS.TEXT_PRIMARY};
  }
`

export const SC_Textarea = styled.textarea`
  width: 100%;
  min-height: 140px;
  resize: vertical;
  padding: ${SPACING.SM} ${SPACING.MD};
  font-size: ${FONT_SIZE.LG};
  line-height: 1.5;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_INPUT};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;
  transition: border-color 0.15s ease;

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
  }

  &:focus {
    border-color: ${COLORS.PRIMARY};
  }
`

export const SC_ArticleToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.SM};
  align-self: flex-start;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  user-select: none;

  & input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: ${COLORS.PRIMARY};
  }
`

export const SC_TitleInput = styled.input`
  width: 100%;
  padding: ${SPACING.SM} ${SPACING.MD};
  font-size: ${FONT_SIZE.XL};
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_INPUT};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
    font-weight: 400;
  }

  &:focus {
    border-color: ${COLORS.PRIMARY};
  }
`

export const SC_Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.MD};
`

const hintProps = { danger: Boolean }

export const SC_Hint = styled('span', hintProps)`
  font-size: ${FONT_SIZE.SM};
  color: ${(props) => (props.danger ? COLORS.DANGER : COLORS.TEXT_SECONDARY)};
`
