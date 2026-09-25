import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'
import { nuxtField } from '@/styles/field-styles'

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
  max-height: min(320px, 50vh);
  overflow-y: auto;
  /* Тот же случай, что и у подсказок тегов: скролл списка не должен листать модалку. */
  overscroll-behavior: contain;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  box-shadow: 0 6px 24px var(--color-overlay-20);
`

export const SC_MentionRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;

  &.active,
  &:hover {
    background: var(--color-bg-hover);
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
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_MentionName = styled.span`
  min-width: 0;
  font-size: 14px;
  color: var(--color-text-primary);
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
  border-radius: var(--ui-radius-sm);
  background: none;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
`

export const SC_Textarea = styled.textarea`
  ${nuxtField}
  /* Текст поста — 16px, как в ленте. */
  min-height: 140px;
  resize: vertical;
  padding: 8px 12px;
  font-size: 16px;
  line-height: 1.5;
`

export const SC_ArticleToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.SM};
  align-self: flex-start;
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;

  & input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }
`

export const SC_TitleInput = styled.input`
  ${nuxtField}
  padding: 8px 12px;
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;

  &::placeholder {
    font-weight: 400;
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
