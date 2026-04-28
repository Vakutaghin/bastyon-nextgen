import styled from 'vue3-styled-components'

export const SC_NotificationsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`

export const SC_NotificationsMenu = styled.div`
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.10);
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
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
`

export const SC_NotificationsTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #333;
`

export const SC_NotificationsHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export const SC_ClearAllButton = styled.button`
  font-size: 12px;
  color: #666;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover {
    color: #1890ff;
    background: rgba(24, 144, 255, 0.06);
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
  border-radius: 8px;
  padding: 10px 12px;
  background: ${(p) => (p.seen ? '#fafafa' : 'rgba(24, 144, 255, 0.05)')};
  border: 1px solid ${(p) => (p.seen ? '#ececec' : 'rgba(24, 144, 255, 0.18)')};
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  display: flex;
  align-items: stretch;
  gap: 8px;
  position: relative;

  &:hover {
    background: ${(p) => (p.seen ? '#f3f3f3' : 'rgba(24, 144, 255, 0.10)')};
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
  border-radius: 4px;
  cursor: pointer;
  color: #999;

  &:hover {
    color: #333;
    background: rgba(0, 0, 0, 0.06);
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
  rating:    { bg: 'rgba(245, 166, 35, 0.14)', fg: '#d48806' },
  like:      { bg: 'rgba(245, 166, 35, 0.14)', fg: '#d48806' },
  comment:   { bg: 'rgba(24, 144, 255, 0.12)', fg: '#0958d9' },
  subscribe: { bg: 'rgba(82, 196, 26, 0.14)',  fg: '#389e0d' },
  repost:    { bg: 'rgba(114, 46, 209, 0.12)', fg: '#531dab' },
  tip:       { bg: 'rgba(250, 219, 20, 0.20)', fg: '#ad8b00' },
  mention:   { bg: 'rgba(235, 47, 150, 0.12)', fg: '#c41d7f' },
  default:   { bg: 'rgba(140, 140, 140, 0.14)', fg: '#595959' }
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
  background: #eee;

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
  background: linear-gradient(135deg, #1890ff, #722ed1);
  color: #fff;
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
  color: #595959;
  line-height: 1.35;
  word-break: break-word;
`

export const SC_NotificationActorName = styled.span`
  font-weight: 600;
  color: #1f1f1f;
  margin-right: 4px;
`

export const SC_NotificationAction = styled.span`
  color: #595959;
`

export const SC_NotificationItemTime = styled.div`
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
`

export const SC_NotificationPreview = styled.div<{ variant?: string }>`
  background: rgba(0, 0, 0, 0.025);
  border-left: 3px solid ${(p) => {
    switch (p.variant) {
      case 'rating':
      case 'like':
        return '#f5a623'
      case 'comment':
        return '#1890ff'
      case 'repost':
        return '#722ed1'
      default:
        return '#d9d9d9'
    }
  }};
  border-radius: 4px;
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
  color: ${(p) => (p.positive ? '#fa8c16' : '#bfbfbf')};
`

export const SC_CommentPreview = styled.div<{ expanded?: boolean }>`
  font-size: 12px;
  color: #333;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  ${(p) => p.expanded ? '' : `
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
  color: #1890ff;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_PostRef = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: #595959;
  min-width: 0;
`

export const SC_PostRefLabel = styled.span`
  color: #8c8c8c;
  flex-shrink: 0;
`

export const SC_PostRefText = styled.span`
  font-style: italic;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
`

export const SC_EmptyMessage = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
`

export const SC_LoaderWrap = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: #999;
`

export const SC_EnrichingHint = styled.div`
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, transparent, rgba(24, 144, 255, 0.4), transparent);
  background-size: 200% 100%;
  animation: nx-pulse 1.2s linear infinite;
  margin-bottom: 4px;

  @keyframes nx-pulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`
