import styled from 'vue3-styled-components'

export const SC_CommentRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  box-sizing: border-box;
  transition: box-shadow 0.4s ease-out;

  &.is-pending {
    opacity: 0.65;
  }

  &.is-mine {
    background: rgba(0, 164, 255, 0.06);
    border-radius: var(--ui-radius-lg);
    padding: 6px 8px;
  }

  &.is-highlighted {
    box-shadow: 0 0 0 2px rgba(0, 164, 255, 0.55);
    border-radius: var(--ui-radius-lg);
  }

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }

  .comment-avatar,
  .comment-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-border-dark);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comment-avatar-placeholder {
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentItem = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  box-sizing: border-box;
  transition: box-shadow 0.4s ease-out;

  &.is-pending {
    opacity: 0.65;
  }

  &.is-mine {
    background: rgba(0, 164, 255, 0.06);
    border-radius: var(--ui-radius-lg);
    padding: 6px 8px;
  }

  &.is-highlighted {
    box-shadow: 0 0 0 2px rgba(0, 164, 255, 0.55);
    border-radius: var(--ui-radius-lg);
  }

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }

  .comment-avatar,
  .comment-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-border-dark);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comment-avatar-placeholder {
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentAuthor = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: var(--ui-text-highlighted);
`

export const SC_CommentText = styled.div`
  font-size: 14px;
  color: var(--color-text-primary) !important;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  :deep(.bastyon-link) {
    color: var(--color-primary) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  a {
    border-bottom: 1px solid var(--color-primary);
  }
`

export const SC_CommentContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_CommentMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }
`

export const SC_CommentDate = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

/** Правый край шапки комментария: дата + кнопка меню */
export const SC_CommentMetaRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

/** Обёртка для сетки картинок в комментарии (уменьшенный масштаб vs пост) */
export const SC_CommentImages = styled.div`
  margin-top: 6px;
  max-width: 480px;

  /* Сетка PostCardImages по умолчанию занимает всю ширину поста; в комменте сжимаем. */
  & > div {
    border-radius: var(--ui-radius-lg);
    overflow: hidden;
  }
`

/** Плашка-заглушка вместо текста удалённого комментария */
export const SC_CommentDeleted = styled.div`
  font-size: 14px;
  font-style: italic;
  color: var(--color-text-secondary);
  line-height: 1.5;
`

/** Плашка-заглушка вместо текста скрытого по репутации комментария */
export const SC_HiddenBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-overlay-4);
  border-radius: var(--ui-radius-lg);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;

  & > span {
    flex: 1;
  }
`

export const SC_RevealBtn = styled.button`
  border: none;
  background: transparent;
  color: var(--ui-primary-text);
  font-size: 13px;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`

/** Плашка-блокировщик публикации (вместо формы ввода) */
export const SC_ComposerDisabled = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-overlay-4);
  border: 1px dashed var(--color-gray-ddd);
  border-radius: var(--ui-radius-lg);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin-top: 8px;
`

/** Контейнер inline-формы редактирования комментария */
export const SC_EditFormWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
`

export const SC_EditFormActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
`

/** Распорка: толкает кнопки Отмена/Сохранить вправо, эмодзи — влево */
export const SC_EditFormSpacer = styled.div`
  flex: 1;
`

export const SC_EditCancelBtn = styled.button`
  padding: 6px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-gray-ddd);
  background: var(--color-bg-primary);
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-gray-ccc);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

export const SC_EditSaveBtn = styled.button`
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  border: 0;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  min-height: 30px;

  &:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`

/** Иконка пера у даты — индикатор отредактированного комментария */
export const SC_EditedMark = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: var(--color-text-secondary);
  gap: 3px;
  margin-left: 4px;
`

/**
 * Бейдж статуса транзакции рядом с датой.
 * Серый — pending (в mempool), красный — rejected.
 */
export const SC_TxStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--ui-radius-lg);
  margin-left: 6px;
  background: var(--color-overlay-6);
  color: var(--color-text-secondary);

  &.tx-status--rejected {
    background: rgba(255, 77, 79, 0.1);
    color: #ff4d4f;
  }

  svg {
    width: 11px;
    height: 11px;
  }
`

export const SC_CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;

  button {
    appearance: none;
    border: none;
    padding: 0;
    margin: 0;
    background: transparent;
    font: inherit;
    text-align: inherit;
  }

  button,
  span {
    font-size: 14px;
    color: var(--color-text-secondary);
    cursor: pointer;
    user-select: none;
  }

  .comment-score {
    filter: grayscale(1);
    cursor: default;
  }
  .comment-score.comment-score--voted {
    filter: none;
  }
  .comment-score.comment-score--clickable {
    cursor: pointer;
  }
`
