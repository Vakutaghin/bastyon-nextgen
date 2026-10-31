import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/** Кольцо хода загрузки (offline-ring). */
export const SC_Ring = styled.svg`
  flex: none;

  .track {
    stroke: currentColor;
    opacity: 0.25;
  }

  .bar {
    stroke: currentColor;
    transition: stroke-dashoffset var(--transition-quick);
  }
`

/** Строка листа выбора качества. */
export const SC_QualityRow = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 10px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text);
  font-size: 15px;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .size {
    color: var(--ui-text-muted);
    font-size: 13px;
  }
`

export const SC_SheetBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_SheetFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 13px;
`

export const SC_Hint = styled.p`
  margin: 0 0 8px;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: calc(1.4 * var(--leading-scale));
`

/** Вкладка «Скачанное». */
export const SC_List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_ListHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 13px;
`

export const SC_Card = styled.div`
  display: flex;
  gap: 12px;
  padding: 8px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);

  &.done {
    cursor: pointer;
  }

  &.done:hover {
    background: var(--ui-bg-accented);
  }
`

export const SC_Thumb = styled.div`
  position: relative;
  flex: none;
  width: 160px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-accented);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text-dimmed);
  font-size: 28px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .duration {
    position: absolute;
    right: 4px;
    bottom: 4px;
    padding: 0 4px;
    border-radius: var(--ui-radius-sm);
    background: rgb(var(--player-panel-rgb) / 80%);
    color: var(--ui-text-inverted);
    font-size: 12px;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 120px;
  }
`

export const SC_CardBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

export const SC_CardTitle = styled.div`
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--ui-text-highlighted);
  font-weight: 500;
  line-height: calc(1.35 * var(--leading-scale));
`

export const SC_CardMeta = styled.div`
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_CardStatus = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--ui-text-muted);
  font-size: 13px;

  &.warn {
    color: var(--ui-warning);
  }

  &.error {
    color: var(--ui-error);
  }
`

export const SC_CardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
`

export const SC_Deleted = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-radius: var(--ui-radius-sm);
  background: var(--ui-bg-accented);
  color: var(--ui-warning);
  font-size: 12px;
`

export const SC_Progress = styled.progress`
  width: 100%;
  height: 4px;
  overflow: hidden;
  border: 0;
  border-radius: var(--ui-radius-xs);
  appearance: none;
  background: var(--ui-bg-accented);

  &::-webkit-progress-bar {
    background: var(--ui-bg-accented);
  }

  &::-webkit-progress-value {
    background: var(--ui-primary);
  }

  &::-moz-progress-bar {
    background: var(--ui-primary);
  }
`

export const SC_Empty = styled.div`
  padding: 32px 16px;
  color: var(--ui-text-muted);
  text-align: center;
  line-height: calc(1.5 * var(--leading-scale));
`

/** Плашка «Нет сети · Скачанное». */
export const SC_OfflineBanner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-size: 14px;

  a {
    font-weight: 500;
  }
`

/** Окно скачанного ролика. */
export const SC_PlayerBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_PlayerTitle = styled.h2`
  margin: 4px 0 0;
  color: var(--ui-text-highlighted);
  font-size: 18px;
  font-weight: 600;
  line-height: calc(1.35 * var(--leading-scale));
`

export const SC_PlayerAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ui-text);
  font-size: 14px;

  img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
`

export const SC_PlayerDescription = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  color: var(--ui-text);
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const SC_PlayerLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`
