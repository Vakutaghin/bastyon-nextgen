import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_CommentsPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  margin-top: 12px;
  border-top: 1px solid var(--color-border-light);
  padding-top: 12px;
`

export const SC_ShowCommentsBtn = styled.button`
  display: inline-block;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--ui-primary-text);
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    cursor: default;
  }
`

export const SC_ShowCommentsBtnSecondary = styled(SC_ShowCommentsBtn)`
  color: var(--color-text-secondary);
  margin-left: 12px;

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
  }
`

export const SC_ShowCommentsBtnCollapse = styled(SC_ShowCommentsBtn)`
  color: var(--color-text-secondary);

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
  }
`

export const SC_CommentsActionsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_CommentsActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_CommentsLoading = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
`

export const SC_CommentsSortRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  label {
    white-space: nowrap;
  }
`

/** Кнопка ручного обновления списка комментариев */
export const SC_RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--ui-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  margin-left: auto;

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`

/**
 * Место под селект сортировки (размер md, 32px) в строке заголовка комментариев.
 * 200px, но на узком экране (320px) сжимается: подпись, селект и кнопка
 * обновления не помещались, и страница прокручивалась вбок.
 */
export const SC_CommentsSortSelect = styled.div`
  flex: 0 1 200px;
  min-width: 0;
`

export const SC_CommentRepliesLink = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  font: inherit;
  text-align: inherit;
  font-size: 12px;
  color: var(--ui-primary-text);
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }

  /* Телефон: в строке действий «Ответы (N)» не помещались вместе с
     «Ответить» и «Ответить автору» — ссылка уходит отдельной строкой под
     них, акцентным цветом, как раскрытие ветки в мобильных клиентах.
     && — сильнее общих правил кнопок строки действий (SC_CommentActions). */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    && {
      order: 1;
      flex-basis: 100%;
      text-align: left;
      color: var(--ui-primary-text);
      font-weight: 500;
    }
  }
`
