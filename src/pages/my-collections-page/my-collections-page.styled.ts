import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// «Коллекции и плейлисты»: фильтр и поиск над группами, в группе — строки.

export const SC_Lead = styled.p`
  max-width: 720px;
  margin: 0 0 20px;
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text-muted);
`

/** «Создать» — у правого края заголовка. */
export const SC_HeadEnd = styled.div`
  margin-left: auto;
`

export const SC_Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  .search {
    flex: 1 1 220px;
    max-width: 320px;
    margin-left: auto;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    .search {
      max-width: none;
      margin-left: 0;
    }
  }
`

export const SC_ChipCount = styled.span`
  margin-left: 6px;
  opacity: 0.7;
`

export const SC_Rows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_Row = styled.li`
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;

  & + & {
    border-top: 1px solid var(--ui-border);
  }

  &:first-child .main {
    border-top-left-radius: var(--ui-radius-lg);
  }

  &:last-child .main {
    border-bottom-left-radius: var(--ui-radius-lg);
  }

  .main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 10px 8px 10px 12px;
    color: var(--ui-text);
    text-decoration: none;
  }

  .main:hover {
    background: var(--ui-bg-muted);
  }

  .main:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: -2px;
  }
`

/** Обложка: широкая у видео и коллекций, квадратная у аудио. */
export const SC_Thumb = styled.span`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 45px;
  overflow: hidden;
  font-size: 20px;
  color: var(--ui-text-dimmed);
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-md);

  &.square {
    width: 45px;
    margin: 0 17.5px;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 64px;
    height: 36px;

    &.square {
      width: 36px;
      margin: 0 14px;
    }
  }
`

export const SC_Text = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .name {
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    color: var(--ui-text-highlighted);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--ui-text-muted);
  }
`

/** Своё изменение не в блоке: «Публикуется», «Удаляется», «Не попало в блок». */
export const SC_State = styled.span`
  flex: none;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-full);

  &.failed {
    color: var(--ui-error);
    background: rgb(var(--ui-error-rgb) / 10%);
  }
`

export const SC_More = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 18px;
  color: var(--ui-text-muted);
  background: none;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  &:hover {
    color: var(--ui-text);
    background: var(--ui-bg-muted);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }
`

/** Пустая группа или сбой загрузки — строкой внутри рамки. */
export const SC_GroupNote = styled.div`
  padding: 16px;
  font-size: 14px;
  color: var(--ui-text-muted);
  border: 1px dashed var(--ui-border);
  border-radius: var(--ui-radius-lg);
`
