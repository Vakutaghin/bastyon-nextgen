import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_NotificationsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color 0.2s;
  color: var(--color-text-primary);

  &:hover {
    background-color: var(--ui-bg-elevated);
  }
`

export const SC_NotificationsMenu = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  padding: 8px;
  min-width: 360px;
  max-width: 440px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

export const SC_NotificationsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px 12px;
  border-bottom: 1px solid var(--color-bg-hover);
  margin-bottom: 8px;
`

export const SC_NotificationsTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
`

export const SC_NotificationsHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export const SC_ClearAllButton = styled.button`
  font-size: 12px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--ui-radius-sm);

  &:hover {
    color: var(--color-ant-blue);
    background: var(--color-ant-blue-bg-light);
  }
`

export const SC_NotificationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 2px;
`

export const SC_NotificationItem = styled.div<{ seen?: boolean }>`
  border-radius: var(--ui-radius-lg);
  padding: 10px 12px;
  background: ${(p) => (p.seen ? COLORS.BG_INPUT : COLORS.ANT_BLUE_BG_LIGHT)};
  border: 1px solid ${(p) => (p.seen ? COLORS.GRAY_EEE : COLORS.ANT_BLUE_BG)};
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s;
  display: flex;
  align-items: stretch;
  gap: 8px;
  position: relative;

  &:hover {
    background: ${(p) => (p.seen ? COLORS.BG_TERTIARY : COLORS.ANT_BLUE_BG_LIGHT)};
  }
`

export const SC_NotificationItemBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_NotificationItemActions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
`

export const SC_NotificationItemTrigger = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  color: var(--color-gray-999);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-overlay-6);
  }
`

export const SC_NotificationHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
`

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  rating: { bg: COLORS.AMBER_SOFT, fg: COLORS.ORANGE_TEXT },
  like: { bg: COLORS.AMBER_SOFT, fg: COLORS.ORANGE_TEXT },
  comment: { bg: COLORS.PRIMARY_BG_12, fg: COLORS.PRIMARY_ACTIVE },
  subscribe: { bg: COLORS.GREEN_ANT_SOFT, fg: COLORS.GREEN_ANT_DEEP },
  repost: { bg: COLORS.PURPLE_SOFT, fg: COLORS.PURPLE_DEEP },
  tip: { bg: COLORS.AMBER_SOFT, fg: COLORS.ORANGE_TEXT },
  mention: { bg: COLORS.PINK_SOFT, fg: COLORS.PINK },
  default: { bg: COLORS.OVERLAY_15, fg: COLORS.GRAY_555 },
}

const colorFor = (variant?: string) => TYPE_COLORS[variant ?? 'default'] ?? TYPE_COLORS.default

export const SC_NotificationTypePill = styled.div<{ variant?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  flex-shrink: 0;
  background: ${(p) => colorFor(p.variant).bg};
  color: ${(p) => colorFor(p.variant).fg};
  line-height: 1;

  .anticon {
    font-size: 12px;
  }
`

export const SC_NotificationActor = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const SC_NotificationAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-gray-eee);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_NotificationAvatarLetter = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-ant-blue), var(--color-purple));
  color: var(--color-white);
  font-weight: 600;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

export const SC_NotificationActorText = styled.div`
  min-width: 0;
  font-size: 12px;
  color: var(--color-gray-555);
  line-height: 1.35;
  word-break: break-word;
`

export const SC_NotificationActorName = styled.span`
  font-weight: 600;
  color: var(--color-text-primary);
  margin-right: 4px;
`

export const SC_NotificationAction = styled.span`
  color: var(--color-gray-555);
`

export const SC_NotificationItemTime = styled.div`
  font-size: 11px;
  color: var(--color-gray-999);
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
`

export const SC_NotificationPreview = styled.div<{ variant?: string }>`
  background: var(--color-overlay-3);
  border-left: 3px solid
    ${(p) => {
      switch (p.variant) {
        case 'rating':
        case 'like':
          return COLORS.WARNING_YELLOW
        case 'comment':
          return COLORS.ANT_BLUE
        case 'repost':
          return COLORS.PURPLE
        default:
          return COLORS.BORDER_DEFAULT
      }
    }};
  border-radius: var(--ui-radius-sm);
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_RatingValue = styled.div<{ positive?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: ${(p) => (p.positive ? COLORS.WARNING_HEX : COLORS.GRAY_CCC)};
`

export const SC_CommentPreview = styled.div<{ expanded?: boolean }>`
  font-size: 12px;
  color: var(--color-text-primary);
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  ${(p) =>
    p.expanded
      ? ''
      : `
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`

export const SC_ExpandToggle = styled.button`
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-ant-blue);

  &:hover {
    text-decoration: underline;
  }
`

export const SC_PostRef = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: var(--color-gray-555);
  min-width: 0;
`

export const SC_PostRefLabel = styled.span`
  color: var(--color-gray-888);
  flex-shrink: 0;
`

export const SC_PostRefText = styled.span`
  font-style: italic;
  color: var(--color-gray-555);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
`

export const SC_EmptyMessage = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: var(--color-gray-999);
  font-size: 13px;
`

export const SC_LoaderWrap = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: var(--color-gray-999);
`

export const SC_EnrichingHint = styled.div`
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--color-primary-light-50), transparent);
  background-size: 200% 100%;
  animation: nx-pulse 1.2s linear infinite;
  margin-bottom: 4px;

  @keyframes nx-pulse {
    0% {
      background-position: 200% 0;
    }

    100% {
      background-position: -200% 0;
    }
  }
`
