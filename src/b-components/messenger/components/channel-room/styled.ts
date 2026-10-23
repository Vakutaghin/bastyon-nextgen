import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ChannelRoom = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

export const SC_ChannelFeed = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/** Дата над постами одного дня — как в ленте сообщений мессенджеров. */
export const SC_DayDivider = styled.div`
  align-self: center;
  margin: 8px 0 2px;
  padding: 2px 10px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 12px;
`

/** Черта перед первым непрочитанным постом. */
export const SC_NewDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  color: var(--ui-violet);
  font-size: 12px;
  font-weight: 500;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgb(var(--ui-violet-rgb) / 40%);
  }
`

export const SC_FeedStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: center;
`

export const SC_Spinner = styled.span`
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-bg-tertiary);
  border-top-color: var(--ui-violet);
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_RetryButton = styled.button`
  padding: 4px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: var(--ui-text-highlighted);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary);
  }
`

/** Пост: пузырь входящего сообщения во всю ширину ленты, но не шире строки для чтения. */
export const SC_Post = styled.div`
  align-self: flex-start;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--ui-radius-lg);
  border-bottom-left-radius: var(--ui-radius-sm);
  background-color: var(--ui-bg-elevated);
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
  box-sizing: border-box;
  overflow: hidden;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-bg-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-violet);
    outline-offset: 2px;
  }
`

export const SC_PostRepost = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ui-text-muted);
  font-size: 12px;
`

export const SC_PostLocked = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ui-text-muted);
`

/** Обложка с постоянными пропорциями: лента не прыгает, пока грузятся картинки. */
export const SC_PostMedia = styled.div`
  position: relative;
  margin: 0 -12px;
  aspect-ratio: 16 / 10;
  max-height: 340px;
  overflow: hidden;
  background: var(--color-bg-tertiary);

  &:first-child {
    margin-top: -8px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_PlayBadge = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${() => COLORS.OVERLAY_55};
  color: ${() => COLORS.WHITE};
  font-size: 22px;
`

export const SC_MoreImages = styled.span`
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: var(--ui-radius-full);
  background: ${() => COLORS.OVERLAY_55};
  color: ${() => COLORS.WHITE};
  font-size: 12px;
  font-weight: 600;
`

/** «Видео» без обложки, «Статья». */
export const SC_PostKind = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ui-violet);
  font-size: 12px;
  font-weight: 500;
`

export const SC_PostTitle = styled.div`
  color: var(--ui-text-highlighted);
  font-weight: 600;
  word-break: break-word;
`

export const SC_PostText = styled.div`
  white-space: pre-line;
  word-break: break-word;
`

export const SC_ReadMore = styled.span`
  color: var(--ui-violet);
  font-size: 13px;
`

export const SC_PostFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ui-text-dimmed);
  font-size: 12px;
`

export const SC_PostStat = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
`

export const SC_PostTime = styled.span`
  margin-left: auto;
`

/** Вместо поля ввода: подписаться и написать автору. */
export const SC_ChannelBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--ui-bg);
  border-top: 1px solid var(--ui-border);
`

export const SC_BarButton = styled.button`
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: transparent;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
  }

  &.primary {
    border-color: var(--ui-primary);
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
  }

  &.primary:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 80%);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`
