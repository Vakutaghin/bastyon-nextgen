import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

/**
 * Одна разметка — две раскладки:
 *  - grid: плитка — обложка, название и «⋯», дата и просмотры, статус, кнопка;
 *  - list: строка — обложка слева, справа название и описание, дальше
 *    колонки статуса, даты, просмотров и действий. На телефоне колонки
 *    складываются под название.
 */
export const SC_Item = styled.li`
  display: grid;
  min-width: 0;

  &.grid {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'thumb thumb'
      'main more'
      'status status'
      'actions actions';
    gap: 6px ${() => SPACING.XS};
    align-content: start;

    .date,
    .views {
      display: none;
    }
  }

  &.list {
    grid-template-columns: 160px minmax(0, 1fr) 150px 110px 100px 150px 32px;
    grid-template-areas: 'thumb main status date views actions more';
    gap: ${() => SPACING.MD};
    align-items: center;
    padding: ${() => SPACING.SM};
    border-bottom: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);

    &:hover {
      background: var(--ui-bg-muted);
    }
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    &.list {
      grid-template-columns: 120px minmax(0, 1fr) 32px;
      grid-template-areas:
        'thumb main more'
        'thumb status status'
        'thumb actions actions';
      gap: 4px ${() => SPACING.SM};
      align-items: start;

      .date,
      .views {
        display: none;
      }
    }
  }
`

export const SC_Thumb = styled.button`
  grid-area: thumb;
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  background: var(--ui-bg-elevated);
  border: 0;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-normal);
  }

  &:hover img {
    transform: scale(1.03);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }

  .list & {
    border-radius: var(--ui-radius-md);
  }
`

export const SC_ThumbEmpty = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text-dimmed);
  font-size: 28px;
`

/** Обложка запускает ролик: круглый «Играть» проступает при наведении и фокусе. */
export const SC_ThumbPlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: 40px;
  background: ${() => COLORS.OVERLAY_25};
  opacity: 0;
  transition: opacity var(--transition-fast);
  pointer-events: none;

  button:hover > &,
  button:focus-visible > & {
    opacity: 1;
  }

  .list & {
    font-size: 28px;
  }
`

/** «Аудио» поверх обложки: звук и видео в списке не перепутать. */
export const SC_ThumbTag = styled.span`
  position: absolute;
  left: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  color: ${() => COLORS.WHITE};
  font-size: 12px;
  background: ${() => COLORS.OVERLAY_70};
  border-radius: var(--ui-radius-md);
`

export const SC_Duration = styled.span`
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  color: ${() => COLORS.WHITE};
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  background: ${() => COLORS.OVERLAY_70};
  border-radius: var(--ui-radius-md);
`

export const SC_Main = styled.div`
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_Title = styled.div`
  min-width: 0;

  button {
    display: -webkit-box;
    width: 100%;
    padding: 0;
    overflow: hidden;
    color: var(--ui-text-highlighted);
    font-size: ${() => FONT_SIZE.MD};
    font-weight: 500;
    line-height: 1.35;
    text-align: left;
    overflow-wrap: anywhere;
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  button:hover {
    color: var(--ui-primary);
  }

  button:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`

/** Описание — только в списке: в плитке на него нет места. */
export const SC_Description = styled.div`
  display: none;
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  line-height: 1.45;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;

  &.empty {
    color: var(--ui-text-dimmed);
  }

  .list & {
    display: -webkit-box;
  }

  /* На телефоне рядом с обложкой — только название и дата. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .list & {
      display: none;
    }
  }
`

/** Дата и просмотры одной строкой — в плитке и на телефоне вместо колонок. */
export const SC_Meta = styled.div`
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};

  .list & {
    display: none;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .list & {
      display: block;
    }
  }
`

export const SC_Status = styled.div`
  grid-area: status;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
`

export const SC_Badge = styled.span`
  padding: 1px 8px;
  color: var(--ui-text-muted);
  font-size: 12px;
  white-space: nowrap;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);

  &.posted {
    color: var(--ui-primary);
    border-color: var(--ui-primary);
  }

  /* Пост ушёл в сеть и ждёт блока. */
  &.publishing {
    color: var(--ui-text-highlighted);
    border-style: dashed;
    border-color: var(--ui-primary);
  }
`

export const SC_Cell = styled.div`
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  &.date {
    grid-area: date;
  }

  &.views {
    grid-area: views;
    text-align: right;
  }
`

export const SC_Actions = styled.div`
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  gap: ${() => SPACING.SM};
  min-width: 0;

  .list & {
    justify-content: flex-end;
  }

  &:empty {
    display: none;
  }
`

export const SC_More = styled.div`
  grid-area: more;
  align-self: start;

  .list & {
    align-self: center;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .list & {
      align-self: start;
    }
  }
`

export const SC_MoreButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--ui-text-muted);
  font-size: 18px;
  background: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }
`
