import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 8px 0 4px;
`

export const SC_Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: var(--ui-radius-lg);
  font-size: 12px;
  font-weight: 500;
  background: var(--color-primary-light);
  color: var(--color-primary);

  &.established {
    background: var(--color-success-bg-tint);
    color: var(--color-success);
  }
`

export const SC_ProfileSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  height: fit-content;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: var(--header-height-total);
  border-radius: var(--ui-radius-lg);
  padding: 20px 0 20px 20px;
  z-index: 10;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_UserAvatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 20px;
  border: 4px solid var(--color-white);
  box-shadow: var(--shadow-sm);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_UserAvatarPlaceholder = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-dimmed);
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  border: 4px solid var(--color-white);
  box-shadow: var(--shadow-sm);
`

export const SC_UserName = styled.h2`
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin-bottom: 20px;
  word-break: break-word;
`

export const SC_UserStats = styled.div`
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: space-between;
  margin: 12px 0 20px;
`

export const SC_StartChatButton = styled.button`
  width: 100%;
  margin: 0 20px 16px 0;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  border: none;
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 6px rgb(var(--ui-primary-rgb) / 12%);

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
  }

  &:disabled {
    background-color: var(--ui-border-accented);
    cursor: not-allowed;
    box-shadow: none;
  }
`

export const SC_EditProfileButton = styled.button`
  width: 100%;
  margin: 0 20px 16px 0;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-primary);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:hover {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }

  .anticon {
    font-size: 14px;
  }
`

export const SC_SubscribeRow = styled.div`
  display: flex;
  gap: 8px;
  margin: 0 20px 12px 0;
`

export const SC_SubscribeButton = styled.button`
  flex: 1;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-primary);
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
  }

  &.subscribed {
    background-color: transparent;
    color: var(--ui-primary);
  }

  &.subscribed:hover {
    background-color: rgb(var(--ui-primary-rgb) / 12%);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 14px;
  }
`

export const SC_BellButton = styled.button`
  flex: 0 0 auto;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }

  &.active {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
    background-color: rgb(var(--ui-primary-rgb) / 12%);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_BlockButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 20px);
  margin: 0 20px 12px 0;
  padding: 9px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST},
    background-color ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  &.blocked {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 14px;
  }
`

export const SC_UserAddress = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  word-break: break-all;
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-top: 10px;
`

export const SC_ExplorerLinkRow = styled.div`
  margin-top: 4px;
  margin-bottom: 8px;
`

export const SC_ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_UserSite = styled.a`
  font-size: 14px;
  color: var(--ui-primary);
  text-decoration: none;
  word-break: break-all;
  display: flex;
  align-items: center;
  border: 0;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 70px;
`

/** Кликабельный счётчик (подписчики/подписки) — открывает список. */
export const SC_StatButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 70px;
  background: none;
  border: none;
  padding: 4px 2px;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_StatLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.2;
`

export const SC_StatValue = styled.span`
  margin-top: 2px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  line-height: 1.2;
`

export const SC_UserAbout = styled.div`
  margin-top: 20px;
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  a {
    color: var(--ui-primary);
    text-decoration: none;

    &:hover {
      text-decoration: none;
      opacity: 0.8;
    }
  }
`

export const SC_LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: var(--ui-text-dimmed);
`
