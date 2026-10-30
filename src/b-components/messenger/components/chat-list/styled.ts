import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

export const SC_ChatListRoot = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`

export const SC_ChatList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
`

/** «Все · Личные · Группы · Каналы» над списком — стоит на месте, список прокручивается. */
export const SC_ChatFilter = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-bg-hover);
`

export const SC_FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: calc(1.4 * var(--leading-scale));
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  &.active {
    border-color: var(--ui-primary);
    background: rgb(var(--ui-primary-rgb) / 10%);
    color: var(--ui-primary);
  }

  /* Каналы — своим цветом, как мегафон у них в списке. */
  &.channels .anticon {
    color: var(--ui-violet);
  }

  &.channels.active {
    border-color: var(--ui-violet);
    background: rgb(var(--ui-violet-rgb) / 10%);
    color: var(--ui-violet);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

/** Сколько нового в разделе, который сейчас не выбран. */
export const SC_ChipCount = styled.span`
  min-width: 16px;
  padding: 0 4px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-text-dimmed);
  color: var(--ui-text-inverted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
`

/** Пустой раздел: что здесь будет и как это получить. */
export const SC_EmptyHint = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 24px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: calc(1.45 * var(--leading-scale));
  text-align: center;

  .anticon {
    font-size: 28px;
    color: var(--ui-violet);
  }

  strong {
    color: var(--ui-text-highlighted);
    font-weight: 500;
  }
`

/** Строка «Загрузка диалогов» над каналами, пока переписки не пришли. */
export const SC_ChatsLoading = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
`

export const SC_ChatsLoadingSpinner = styled.span`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 2px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

/** Лупа в шапке мессенджера: по нажатию над списком раскрывается поле поиска. */
export const SC_SearchToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  &.active {
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

/** Поле поиска на месте ряда разделов: лупа, ввод, значок загрузки, крестик. */
export const SC_SearchBar = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--color-bg-hover);
  color: var(--color-text-secondary);

  > .anticon {
    flex-shrink: 0;
    font-size: 16px;
  }
`

export const SC_SearchInput = styled.input`
  ${nuxtField}
  flex: 1;
  min-width: 0;
  padding: 5px 10px;

  &::-webkit-search-cancel-button {
    display: none;
  }
`

export const SC_SearchClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

/** Подпись раздела выдачи: «Чаты и группы», «Люди в Bastyon». */
export const SC_SearchSection = styled.div`
  padding: 10px 16px 6px;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

/** «Ничего не нашлось» и подсказки в выдаче. */
export const SC_SearchNote = styled.div`
  padding: 6px 16px 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
`

/** Человек из поиска по сети — строка как у чата, только короче. */
export const SC_PersonRow = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--color-bg-hover);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-bg-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }
`

export const SC_PersonInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_PersonName = styled.span`
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_PersonAddress = styled.span`
  color: var(--ui-text-dimmed);
  font-size: 12px;
`
