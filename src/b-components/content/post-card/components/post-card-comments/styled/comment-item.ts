import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_CommentRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;

  &.is-pending {
    opacity: 0.65;
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
    background: rgb(222, 226, 230);
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
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentItem = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;

  &.is-pending {
    opacity: 0.65;
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
    background: rgb(222, 226, 230);
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
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentAuthor = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_CommentText = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY} !important;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  :deep(.bastyon-link) {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  a {
    border-bottom: 1px solid ${COLORS.PRIMARY};
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
  color: ${COLORS.TEXT_SECONDARY};
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
    border-radius: 10px;
    overflow: hidden;
  }
`

/** Плашка-заглушка вместо текста удалённого комментария */
export const SC_CommentDeleted = styled.div`
  font-size: 14px;
  font-style: italic;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.5;
`

/** Плашка-заглушка вместо текста скрытого по репутации комментария */
export const SC_HiddenBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.4;

  & > span {
    flex: 1;
  }
`

export const SC_RevealBtn = styled.button`
  border: none;
  background: transparent;
  color: #00a4ff;
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
  background: rgba(0, 0, 0, 0.04);
  border: 1px dashed #ddd;
  border-radius: 12px;
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
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

export const SC_EditCancelBtn = styled.button`
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #ccc;
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

export const SC_EditSaveBtn = styled.button`
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid #00a4ff;
  background: #00a4ff;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  min-height: 30px;

  &:hover:not(:disabled) {
    background: #0088d1;
    border-color: #0088d1;
  }
  &:disabled {
    cursor: not-allowed;
    background: #ccc;
    border-color: #ccc;
  }
`

/** Иконка пера у даты — индикатор отредактированного комментария */
export const SC_EditedMark = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
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
  border-radius: 8px;
  margin-left: 6px;
  background: rgba(0, 0, 0, 0.06);
  color: ${COLORS.TEXT_SECONDARY};

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

  span {
    font-size: 14px;
    color: ${COLORS.TEXT_SECONDARY};
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
