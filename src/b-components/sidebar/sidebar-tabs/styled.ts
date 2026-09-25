import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const tabProps = {
  active: Boolean,
  disabled: Boolean,
}

export const SC_Tabs = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ui-border);

  &.collapsed {
    padding-bottom: 12px;
  }

  &.collapsed button {
    justify-content: center;
    padding: 8px;
  }
`

// Пункт навигации как у Nuxt UI (UNavigationMenu, vertical): 14px/500,
// приглушённый текст; hover — подложка elevated/50 и яркий текст; активный —
// акцентный текст на подложке elevated, без полоски сбоку.
export const SC_TabsItem = styled('button', tabProps)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  background: none;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  position: relative;
  opacity: 1;
  width: 100%;

  /* Target both AntD icon wrapper and potential direct SVGs */
  & > .anticon,
  & > svg {
    font-size: 18px;
    width: 20px;
    flex-shrink: 0;
    color: var(--ui-text-dimmed);
    transition: color 0.15s;
  }

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }

  &:hover > .anticon,
  &:hover > svg {
    color: var(--ui-text);
  }

  ${(props) =>
    props.active &&
    css`
      background: var(--ui-bg-elevated);
      color: var(--ui-primary);

      & > .anticon,
      & > svg,
      &:hover > .anticon,
      &:hover > svg {
        color: var(--ui-primary);
      }

      &:hover {
        background: var(--ui-bg-elevated);
        color: var(--ui-primary);
      }
    `}

  ${(props) =>
    props.disabled &&
    css`
      cursor: not-allowed;
      opacity: 0.5;

      &:hover {
        background: none;
        color: var(--ui-text-muted);
      }
    `}
`

export const SC_TabsLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`

// ─── Favorites (закреплённые миниаппы) ────────────────────────────────────────

export const SC_FavoritesSection = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 24px;

  &.collapsed button {
    justify-content: center;
    padding: 8px;
  }
`

const favItemProps = { active: Boolean }

/** Закреплённая мини-аппа — тот же пункт навигации, что SC_TabsItem. */
export const SC_FavoritesItem = styled('button', favItemProps)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  background: none;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  position: relative;
  width: 100%;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }

  ${(props) =>
    props.active &&
    css`
      background: var(--ui-bg-elevated);
      color: var(--ui-primary);

      &:hover {
        background: var(--ui-bg-elevated);
        color: var(--ui-primary);
      }
    `}
`

export const SC_FavIconWrap = styled.div`
  width: 20px;
  height: 20px;
  border-radius: var(--ui-radius-sm);
  overflow: hidden;
  flex: 0 0 auto;
  background: var(--ui-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SC_FavIcon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_FavIconFallback = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_FavLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`
