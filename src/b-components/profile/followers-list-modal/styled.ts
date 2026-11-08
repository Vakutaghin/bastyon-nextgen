import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'
import { noSelect } from '@/styles/chrome-styles'

export const SC_List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
`

export const SC_Row = styled.div`
  ${noSelect}
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--ui-radius-lg);
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_RowMain = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: var(--color-text-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RowName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-quick);

  /* Строка целиком — кнопка перехода в профиль: на наведении имя как ссылка. */
  button:hover > * > &,
  button:hover > & {
    color: var(--ui-primary-text);
  }
`

export const SC_RowMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`

export const SC_FollowBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--ui-text-inverted);
  font-size: 12px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  &.subscribed {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-color: var(--color-border-default);
  }
`

export const SC_State = styled.div`
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_LoadMore = styled.button`
  margin: 8px auto 0;
  display: block;
  padding: 8px 18px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

/** Поиск и порядок над списком. */
export const SC_Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
`

export const SC_SortRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

export const SC_SortButton = styled.button`
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
  }

  &.active {
    border-color: var(--ui-primary);
    background: rgb(var(--ui-primary-rgb) / 10%);
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }

  &:last-of-type {
    margin-right: auto;
  }
`

export const SC_SearchHint = styled.div`
  color: var(--color-text-secondary);
  font-size: 12px;
`
