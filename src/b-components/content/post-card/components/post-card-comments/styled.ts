import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_CommentsPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  margin-top: 12px;
  border-top: 1px solid ${COLORS.BORDER_LIGHT};
  padding-top: 12px;
`

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

  & > span { flex: 1; }
`

export const SC_RevealBtn = styled.button`
  border: none;
  background: transparent;
  color: #00a4ff;
  font-size: 13px;
  cursor: pointer;
  padding: 0;

  &:hover { text-decoration: underline; }
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

  svg { width: 11px; height: 11px; }
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

export const SC_ShowCommentsBtn = styled.button`
  display: inline-block;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: #00a4ff;
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
  color: rgba(0, 0, 0, 0.45);
  margin-left: 12px;

  &:hover:not(:disabled) {
    color: rgba(0, 0, 0, 0.65);
  }
`

export const SC_ShowCommentsBtnCollapse = styled(SC_ShowCommentsBtn)`
  color: rgba(0, 0, 0, 0.45);

  &:hover:not(:disabled) {
    color: rgba(0, 0, 0, 0.65);
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
`

/** Кнопка ручного обновления списка комментариев */
export const SC_RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #fff;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  margin-left: auto;

  &:hover:not(:disabled) {
    background: #f5f5f5;
    color: ${COLORS.TEXT_PRIMARY};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  svg { width: 14px; height: 14px; }
`

export const SC_CommentsSortSelect = styled.select`
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  padding: 4px 8px;
  border: 1px solid rgb(222, 226, 230);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  min-width: 180px;

  &:focus {
    outline: none;
    border-color: #00a4ff;
  }
`

export const SC_CommentRepliesLink = styled.span`
  font-size: 13px;
  color: #00a4ff;
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_CommentWithReplies = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 0;
`

export const SC_CommentReplies = styled.div`
  margin-left: 50px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

/** Обёртка одного ответа второго уровня: комментарий + плашка ответа под ним */
export const SC_ReplyItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
`

export const SC_CommentRepliesToggle = styled.button`
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  text-align: left;
  margin-left: 50px;
  margin-top: 10px;
  margin-bottom: 20px;

  &:hover {
    color: rgba(0, 0, 0, 0.65);
    text-decoration: underline;
  }
`

/** Плашка ответа под комментарием: аватар + textarea + кнопки */
export const SC_ReplyPanel = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  background: #f5f5f5;
  border: 1px solid #eee;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;

  .reply-avatar,
  .reply-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgb(222, 226, 230);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .reply-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .reply-avatar-placeholder {
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: 600;
    font-size: 14px;
  }
`

/** Вложенная плашка ответа 1-го уровня (ответ на комментарий): отступ слева для визуальной ветки */
export const SC_ReplyPanelNested = styled(SC_ReplyPanel)`
  margin-left: 50px;
  width: calc(100% - 50px);
`

/** Вложенная плашка ответа 2-го уровня (ответ на ответ): без доп. отступа, т.к. уже внутри ветки с отступом */
export const SC_ReplyPanelNestedLevel2 = styled(SC_ReplyPanel)``

export const SC_ReplyInputWrap = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_ReplyTextarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 14px;
  outline: none;
  resize: none;
  overflow-y: auto;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.45;
  font-family: inherit;
  background: #fff;

  &:focus {
    border-color: #00a4ff;
  }

  &::placeholder {
    color: ${COLORS.TEXT_SECONDARY};
  }
`

export const SC_MentionList = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
`

export const SC_MentionItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:hover {
    background: #f0f0f0;
  }

  &.mention-item--highlighted {
    background: #e6f4ff;
  }
`

export const SC_ReplySendBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #00a4ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    background: #0088d1;
  }
  svg { width: 18px; height: 18px; fill: currentColor; }
`

export const SC_ReplyCancelBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: ${COLORS.TEXT_PRIMARY};
  }
  svg { width: 18px; height: 18px; }
`

/** Инлайн-подтверждение отмены ответа (без модалки, без скачка скролла) */
export const SC_ConfirmWrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const SC_ConfirmMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  flex: 1;
`

export const SC_ConfirmActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`

export const SC_ConfirmBtn = styled.button`
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:hover {
    background: #f5f5f5;
    border-color: #ccc;
  }

  &.confirm-btn--primary {
    background: #00a4ff;
    border-color: #00a4ff;
    color: #fff;
  }
  &.confirm-btn--primary:hover {
    background: #0088d1;
    border-color: #0088d1;
  }
`

/** Счётчик оставшихся символов под полем ввода. Показывается только когда осталось мало. */
export const SC_LengthCounter = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  padding: 2px 14px 0;
  line-height: 1.3;

  &.length-counter--bad {
    color: #ff4d4f;
  }
`

/** Кнопка-триггер контекстного меню комментария (три точки) */
export const SC_MenuTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  border-radius: 50%;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: ${COLORS.TEXT_PRIMARY};
  }

  svg { width: 16px; height: 16px; }
`

/** Контейнер списка пунктов меню в поповере */
export const SC_MenuList = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 4px 0;
`

/** Пункт меню */
export const SC_MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: #f5f5f5;
  }

  &.menu-item--danger {
    color: #ff4d4f;
  }
  &.menu-item--danger:hover {
    background: rgba(255, 77, 79, 0.08);
  }

  svg { width: 14px; height: 14px; }
`
